import express from "express";
import http from "http";
import path from "path";
import fs from "fs";
import { WebSocketServer, WebSocket } from "ws";
import { createServer as createViteServer } from "vite";
import nodemailer from "nodemailer";
import { 
  INITIAL_CLASSES, 
  INITIAL_STUDENTS, 
  INITIAL_SESSIONS, 
  INITIAL_JUSTIFICATIONS, 
  INITIAL_PROFESSORS,
  DEFAULT_SETTINGS,
  INITIAL_STUDENT_GRADES
} from "./src/data/initialData";

const PORTA = Number(process.env.PORT) || 8080;
const DB_DIR = path.join(process.cwd(), "data");
const DB_FILE = path.join(DB_DIR, "db.json");

interface ServerDatabase {
  professors: any[];
  activeProfessorId: string;
  classes: any[];
  students: any[];
  sessions: any[];
  deletedSessionIds?: string[];
  deletedProfessorIds?: string[];
  deletedStudentIds?: string[];
  deletedClassIds?: string[];
  justifications: any[];
  studentGrades: any[];
  appSettings: any;
  lessonTitles: string[];
  selectedClassId: string;
  teacherPresences?: Record<string, any>;
  connectedDevices?: Record<string, any>;
  lastUpdated: number;
}

// Initial Database Factory
function getInitialDbState(): ServerDatabase {
  return {
    professors: INITIAL_PROFESSORS || [],
    activeProfessorId: INITIAL_PROFESSORS[0]?.id || "",
    classes: INITIAL_CLASSES || [],
    students: INITIAL_STUDENTS || [],
    sessions: INITIAL_SESSIONS || [],
    deletedSessionIds: [],
    deletedProfessorIds: [],
    deletedStudentIds: [],
    deletedClassIds: [],
    justifications: INITIAL_JUSTIFICATIONS || [],
    studentGrades: INITIAL_STUDENT_GRADES || [],
    appSettings: DEFAULT_SETTINGS,
    lessonTitles: [],
    selectedClassId: INITIAL_CLASSES[0]?.id || "",
    teacherPresences: {},
    connectedDevices: {},
    lastUpdated: 1,
  };
}

// Load or Initialize DB
function loadDatabase(): ServerDatabase {
  try {
    if (!fs.existsSync(DB_DIR)) {
      fs.mkdirSync(DB_DIR, { recursive: true });
    }
    if (fs.existsSync(DB_FILE)) {
      const raw = fs.readFileSync(DB_FILE, "utf-8");
      const parsed = JSON.parse(raw);
      if (parsed && Array.isArray(parsed.students)) {
        let ts = Number(parsed.lastUpdated) || 1;
        if (ts > 4000000000000 || isNaN(ts)) {
          ts = 1;
        }
        const deletedStudentIds = Array.isArray(parsed.deletedStudentIds) ? parsed.deletedStudentIds : [];
        const deletedStudentSet = new Set(deletedStudentIds);
        const filteredStudents = (parsed.students || []).filter((s: any) => s && s.id && !deletedStudentSet.has(s.id));

        const deletedClassIds = Array.isArray(parsed.deletedClassIds) ? parsed.deletedClassIds : [];
        const deletedClassSet = new Set(deletedClassIds);
        const filteredClasses = (parsed.classes || []).filter((c: any) => c && c.id && !deletedClassSet.has(c.id));

        const deletedSessionIds = Array.isArray(parsed.deletedSessionIds) ? parsed.deletedSessionIds : [];
        const deletedSessionSet = new Set(deletedSessionIds);
        const filteredSessions = (parsed.sessions || []).filter((s: any) => s && s.id && !deletedSessionSet.has(s.id));

        return {
          ...getInitialDbState(),
          ...parsed,
          students: filteredStudents,
          classes: filteredClasses,
          sessions: filteredSessions,
          deletedSessionIds,
          deletedProfessorIds: Array.isArray(parsed.deletedProfessorIds) ? parsed.deletedProfessorIds : [],
          deletedStudentIds,
          deletedClassIds,
          lastUpdated: ts,
        };
      }
    }
  } catch (err) {
    console.error("Error reading database file, initializing fallback:", err);
  }

  const initial = getInitialDbState();
  saveDatabase(initial);
  return initial;
}

let dbState: ServerDatabase = loadDatabase();

let saveDbTimeout: NodeJS.Timeout | null = null;
let isSaving = false;
let pendingSaveState: ServerDatabase | null = null;

async function executeSave() {
  if (!pendingSaveState || isSaving) return;
  isSaving = true;
  const stateToSave = pendingSaveState;
  pendingSaveState = null;
  try {
    if (!fs.existsSync(DB_DIR)) {
      fs.mkdirSync(DB_DIR, { recursive: true });
    }
    const json = JSON.stringify(stateToSave);
    const tempFile = `${DB_FILE}.${Date.now()}.${Math.random().toString(36).substring(2, 7)}.tmp`;
    await fs.promises.writeFile(tempFile, json, "utf-8");
    await fs.promises.rename(tempFile, DB_FILE);
  } catch (err) {
    console.error("Error saving database file:", err);
  } finally {
    isSaving = false;
    if (pendingSaveState) {
      executeSave();
    }
  }
}

function saveDatabase(state: ServerDatabase, immediate = false) {
  pendingSaveState = state;
  if (immediate) {
    if (saveDbTimeout) {
      clearTimeout(saveDbTimeout);
      saveDbTimeout = null;
    }
    executeSave();
    return;
  }
  if (!saveDbTimeout) {
    saveDbTimeout = setTimeout(() => {
      saveDbTimeout = null;
      executeSave();
    }, 250);
  }
}

// Periodic Backup Routine (every 30 minutes)
setInterval(async () => {
  try {
    if (!fs.existsSync(DB_DIR)) return;
    const backupDir = path.join(DB_DIR, "backups");
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const backupFile = path.join(backupDir, `db-backup-${timestamp}.json`);
    const json = JSON.stringify(dbState, null, 2);
    await fs.promises.writeFile(backupFile, json, "utf-8");

    // Keep only last 20 backups
    const files = await fs.promises.readdir(backupDir);
    const jsonFiles = files.filter(f => f.startsWith("db-backup-") && f.endsWith(".json")).sort();
    if (jsonFiles.length > 20) {
      const oldFiles = jsonFiles.slice(0, jsonFiles.length - 20);
      for (const oldFile of oldFiles) {
        await fs.promises.unlink(path.join(backupDir, oldFile)).catch(() => {});
      }
    }
    console.log(`[Backup Service] Periodic snapshot saved successfully: db-backup-${timestamp}.json`);
  } catch (err) {
    console.error("[Backup Service] Error creating periodic backup:", err);
  }
}, 30 * 60 * 1000);

function mergeAttendanceRecord(currentRec: any, incomingRec: any): any {
  if (!currentRec && !incomingRec) return null;
  if (!currentRec) return incomingRec;
  if (!incomingRec) return currentRec;

  const mergeStatus = (curr?: string, inc?: string): string => {
    // If either side recorded attendance as present/late/excused, never revert back to absent
    if (curr === 'present' || inc === 'present') return 'present';
    if (curr === 'late' || inc === 'late') return 'late';
    if (curr === 'excused' || inc === 'excused') return 'excused';
    return inc || curr || 'absent';
  };

  return {
    ...currentRec,
    ...incomingRec,
    status: mergeStatus(currentRec.status, incomingRec.status),
    period1Status: mergeStatus(currentRec.period1Status, incomingRec.period1Status),
    period2Status: mergeStatus(currentRec.period2Status, incomingRec.period2Status),
    p1StartStatus: mergeStatus(currentRec.p1StartStatus, incomingRec.p1StartStatus),
    p1EndStatus: mergeStatus(currentRec.p1EndStatus, incomingRec.p1EndStatus),
    p2StartStatus: mergeStatus(currentRec.p2StartStatus, incomingRec.p2StartStatus),
    p2EndStatus: mergeStatus(currentRec.p2EndStatus, incomingRec.p2EndStatus),
    p1StartTimestamp: incomingRec.p1StartTimestamp || currentRec.p1StartTimestamp,
    p1EndTimestamp: incomingRec.p1EndTimestamp || currentRec.p1EndTimestamp,
    p2StartTimestamp: incomingRec.p2StartTimestamp || currentRec.p2StartTimestamp,
    p2EndTimestamp: incomingRec.p2EndTimestamp || currentRec.p2EndTimestamp,
    period1Timestamp: incomingRec.period1Timestamp || currentRec.period1Timestamp,
    period2Timestamp: incomingRec.period2Timestamp || currentRec.period2Timestamp,
    timestamp: (incomingRec.status === 'present' ? incomingRec.timestamp : undefined) || 
               (currentRec.status === 'present' ? currentRec.timestamp : undefined) || 
               incomingRec.timestamp || currentRec.timestamp,
    epiVerified: incomingRec.epiVerified ?? currentRec.epiVerified ?? true,
    checkinMethod: incomingRec.checkinMethod || currentRec.checkinMethod || 'qrcode',
    deviceId: incomingRec.deviceId || currentRec.deviceId,
  };
}

function mergeSessions(
  currentSessions: any[], 
  incomingSessions: any[], 
  deletedIds: string[] = []
): any[] {
  const deletedSet = new Set(deletedIds || []);
  const resultMap = new Map<string, any>();

  // 1. Index current non-deleted sessions
  (currentSessions || []).forEach((s: any) => {
    if (s && s.id && !deletedSet.has(s.id)) {
      resultMap.set(s.id, { ...s });
    }
  });

  // 2. Merge incoming non-deleted sessions
  if (Array.isArray(incomingSessions)) {
    incomingSessions.forEach((inc: any) => {
      if (!inc || !inc.id || deletedSet.has(inc.id)) return;
      const existing = resultMap.get(inc.id);
      if (!existing) {
        resultMap.set(inc.id, { ...inc });
      } else {
        const mergedAttendance = { ...(existing.attendance || {}) };
        const incAttendance = inc.attendance || {};
        for (const [stId, incRec] of Object.entries(incAttendance)) {
          const merged = mergeAttendanceRecord(mergedAttendance[stId], incRec);
          if (merged) {
            mergedAttendance[stId] = merged;
          }
        }

        resultMap.set(inc.id, {
          ...existing,
          ...inc,
          attendance: mergedAttendance,
          isLive: inc.isLive !== undefined ? inc.isLive : existing.isLive,
          isLocked: inc.isLocked !== undefined ? inc.isLocked : existing.isLocked,
          isPaused: inc.isPaused !== undefined ? inc.isPaused : existing.isPaused,
          activePeriod: inc.activePeriod || existing.activePeriod,
          isPeriod1Locked: inc.isPeriod1Locked ?? existing.isPeriod1Locked,
          isPeriod2Locked: inc.isPeriod2Locked ?? existing.isPeriod2Locked,
          coProfessors: Array.isArray(inc.coProfessors) ? inc.coProfessors : existing.coProfessors,
        });
      }
    });
  }

  const mergedList = Array.from(resultMap.values());
  mergedList.sort((a: any, b: any) => {
    const scoreA = (a.isLive && !a.isLocked) ? 1000 : a.isLive ? 500 : 0;
    const scoreB = (b.isLive && !b.isLocked) ? 1000 : b.isLive ? 500 : 0;
    if (scoreA !== scoreB) return scoreB - scoreA;
    const timeA = a.timestamp || (a.date ? new Date(a.date).getTime() : 0);
    const timeB = b.timestamp || (b.date ? new Date(b.date).getTime() : 0);
    return timeB - timeA;
  });
  return mergedList;
}

function mergeStudents(currentStudents: any[], incomingStudents: any[], deletedIds: string[] = []): any[] {
  const deletedSet = new Set(deletedIds || []);
  if (!Array.isArray(incomingStudents) || incomingStudents.length === 0) {
    return (currentStudents || []).filter((st: any) => st && st.id && !deletedSet.has(st.id));
  }
  const resultMap = new Map<string, any>();
  (currentStudents || []).forEach((st: any) => {
    if (st && st.id && !deletedSet.has(st.id)) resultMap.set(st.id, { ...st });
  });

  incomingStudents.forEach((inc: any) => {
    if (!inc || !inc.id || deletedSet.has(inc.id)) return;
    const existing = resultMap.get(inc.id);
    if (!existing) {
      resultMap.set(inc.id, { ...inc });
    } else {
      resultMap.set(inc.id, {
        ...existing,
        ...inc,
      });
    }
  });

  return Array.from(resultMap.values());
}

function mergeClasses(currentClasses: any[], incomingClasses: any[], deletedIds: string[] = []): any[] {
  const deletedSet = new Set(deletedIds || []);
  if (!Array.isArray(incomingClasses) || incomingClasses.length === 0) {
    return (currentClasses || []).filter((c: any) => c && c.id && !deletedSet.has(c.id));
  }
  const resultMap = new Map<string, any>();
  (currentClasses || []).forEach((c: any) => {
    if (c && c.id && !deletedSet.has(c.id)) resultMap.set(c.id, { ...c });
  });

  incomingClasses.forEach((inc: any) => {
    if (!inc || !inc.id || deletedSet.has(inc.id)) return;
    const existing = resultMap.get(inc.id);
    if (!existing) {
      resultMap.set(inc.id, { ...inc });
    } else {
      resultMap.set(inc.id, { ...existing, ...inc });
    }
  });

  return Array.from(resultMap.values());
}

function mergeProfessors(currentProfessors: any[], incomingProfessors: any[], deletedIds: string[] = []): any[] {
  if (!Array.isArray(incomingProfessors) || incomingProfessors.length === 0) {
    const deletedSet = new Set(deletedIds);
    return (currentProfessors || []).filter((p: any) => p && p.id && !deletedSet.has(p.id));
  }
  const deletedSet = new Set(deletedIds);
  const resultMap = new Map<string, any>();
  (currentProfessors || []).forEach((p: any) => {
    if (p && p.id && !deletedSet.has(p.id)) resultMap.set(p.id, { ...p });
  });

  incomingProfessors.forEach((inc: any) => {
    if (!inc || !inc.id || deletedSet.has(inc.id)) return;
    const existing = resultMap.get(inc.id);
    if (!existing) {
      resultMap.set(inc.id, { ...inc });
    } else {
      resultMap.set(inc.id, {
        ...existing,
        ...inc,
        pin: inc.pin || existing.pin,
        role: inc.role || existing.role,
      });
    }
  });

  return Array.from(resultMap.values());
}

function mergeJustifications(currentJustifications: any[], incomingJustifications: any[]): any[] {
  if (!Array.isArray(incomingJustifications)) {
    return currentJustifications || [];
  }
  const resultMap = new Map<string, any>();
  (currentJustifications || []).forEach((j: any) => {
    if (j && j.id) resultMap.set(j.id, { ...j });
  });

  incomingJustifications.forEach((inc: any) => {
    if (!inc || !inc.id) return;
    const existing = resultMap.get(inc.id);
    if (!existing) {
      resultMap.set(inc.id, { ...inc });
    } else {
      resultMap.set(inc.id, { ...existing, ...inc });
    }
  });

  return Array.from(resultMap.values());
}

function mergeStudentGrades(currentGrades: any[], incomingGrades: any[]): any[] {
  if (!Array.isArray(incomingGrades)) {
    return currentGrades || [];
  }
  const resultMap = new Map<string, any>();
  (currentGrades || []).forEach((g: any) => {
    const key = g?.studentId ? `${g.studentId}_${g.classGroupId || ''}` : (g?.id || '');
    if (key) resultMap.set(key, { ...g });
  });

  incomingGrades.forEach((inc: any) => {
    const key = inc?.studentId ? `${inc.studentId}_${inc.classGroupId || ''}` : (inc?.id || '');
    if (!key) return;
    const existing = resultMap.get(key);
    if (!existing) {
      resultMap.set(key, { ...inc });
    } else {
      resultMap.set(key, { 
        ...existing, 
        ...inc,
        scores: { ...(existing.scores || {}), ...(inc.scores || {}) }
      });
    }
  });

  return Array.from(resultMap.values());
}

function recalculateStudentStats(students: any[], sessions: any[]): any[] {
  if (!Array.isArray(students)) return [];
  const safeSessions = Array.isArray(sessions) ? sessions : [];

  return students.map(st => {
    let presences = 0;
    let absences = 0;
    let lates = 0;
    let excused = 0;
    const stSessions = safeSessions.filter(s => s.classGroupId === st.classGroupId);
    const totalClasses = stSessions.length;

    stSessions.forEach(sess => {
      const cleanRa = (st.registrationNumber || '').replace(/\D/g, '');
      const rec = sess.attendance?.[st.id] ||
        (st.registrationNumber && sess.attendance?.[st.registrationNumber]) ||
        (cleanRa && sess.attendance?.[cleanRa]) ||
        Object.values(sess.attendance || {}).find((r: any) => {
          if (!r) return false;
          if (r.studentId === st.id) return true;
          const rRa = (r.studentRa || r.registrationNumber || '')?.toString().replace(/\D/g, '');
          return cleanRa && rRa && (cleanRa === rRa || cleanRa.endsWith(rRa) || rRa.endsWith(cleanRa));
        });

      if (rec) {
        const isPresent = rec.status === 'present' || 
          rec.period1Status === 'present' || 
          rec.period2Status === 'present' || 
          rec.p1StartStatus === 'present' || 
          rec.p1EndStatus === 'present' || 
          rec.p2StartStatus === 'present' || 
          rec.p2EndStatus === 'present';
        const isLate = rec.status === 'late' || rec.period1Status === 'late' || rec.period2Status === 'late';
        const isExcused = rec.status === 'excused' || rec.period1Status === 'excused' || rec.period2Status === 'excused';

        if (isPresent) {
          presences++;
        } else if (isLate) {
          presences++;
          lates++;
        } else if (isExcused) {
          presences++;
          excused++;
        } else {
          absences++;
        }
      } else {
        absences++;
      }
    });

    return {
      ...st,
      presences,
      absences,
      lates,
      excused,
      totalClasses,
    };
  });
}

function mergeState(current: ServerDatabase, incoming: any): ServerDatabase {
  if (!incoming || typeof incoming !== "object") return current;

  if (incoming.isExplicitReset) {
    return {
      ...getInitialDbState(),
      lastUpdated: Date.now(),
    };
  }

  const mergedDeletedSessionIds = Array.from(new Set([
    ...(current.deletedSessionIds || []),
    ...(Array.isArray(incoming.deletedSessionIds) ? incoming.deletedSessionIds : [])
  ]));

  const mergedDeletedProfessorIds = Array.from(new Set([
    ...(current.deletedProfessorIds || []),
    ...(Array.isArray(incoming.deletedProfessorIds) ? incoming.deletedProfessorIds : [])
  ]));

  const mergedDeletedStudentIds = Array.from(new Set([
    ...(current.deletedStudentIds || []),
    ...(Array.isArray(incoming.deletedStudentIds) ? incoming.deletedStudentIds : [])
  ]));

  const mergedDeletedClassIds = Array.from(new Set([
    ...(current.deletedClassIds || []),
    ...(Array.isArray(incoming.deletedClassIds) ? incoming.deletedClassIds : [])
  ]));

  // If user mutation is explicitly sent (e.g. user added/deleted students, classes, professors), adopt the explicit user state
  const professors = incoming.userMutation && Array.isArray(incoming.professors)
    ? incoming.professors.filter((p: any) => p && p.id && !mergedDeletedProfessorIds.includes(p.id))
    : mergeProfessors(current.professors, incoming.professors, mergedDeletedProfessorIds);

  const classes = incoming.userMutation && Array.isArray(incoming.classes)
    ? incoming.classes.filter((c: any) => c && c.id && !mergedDeletedClassIds.includes(c.id))
    : mergeClasses(current.classes, incoming.classes, mergedDeletedClassIds);

  // Critical fix: When user deleted sessions (userMutation: true), strictly adopt the filtered list without reviving deleted sessions!
  const sessions = incoming.userMutation && Array.isArray(incoming.sessions)
    ? incoming.sessions.filter((s: any) => s && s.id && !mergedDeletedSessionIds.includes(s.id))
    : mergeSessions(current.sessions, incoming.sessions, mergedDeletedSessionIds);

  const rawStudents = incoming.userMutation && Array.isArray(incoming.students)
    ? incoming.students.filter((st: any) => st && st.id && !mergedDeletedStudentIds.includes(st.id))
    : mergeStudents(current.students, incoming.students, mergedDeletedStudentIds);
  const students = recalculateStudentStats(rawStudents, sessions);

  const justifications = incoming.userMutation && Array.isArray(incoming.justifications)
    ? incoming.justifications
    : mergeJustifications(current.justifications, incoming.justifications);

  const studentGrades = incoming.userMutation && Array.isArray(incoming.studentGrades)
    ? incoming.studentGrades
    : mergeStudentGrades(current.studentGrades, incoming.studentGrades);

  const appSettings = incoming.appSettings ? { ...current.appSettings, ...incoming.appSettings } : current.appSettings;
  const activeProfessorId = current.activeProfessorId || professors[0]?.id || "";
  const selectedClassId = current.selectedClassId || classes[0]?.id || "";

  const clientTimestamp = Number(incoming.lastUpdated) || 0;
  const validClientTs = (clientTimestamp > 4000000000000 || isNaN(clientTimestamp)) ? Date.now() : clientTimestamp;
  const newTs = Math.max(validClientTs, current.lastUpdated || 0, Date.now());

  const now = Date.now();
  const teacherPresences: Record<string, any> = {
    ...(current.teacherPresences || {}),
    ...(incoming.teacherPresences || {}),
  };
  // Clean expired teacher presences (> 90s)
  Object.keys(teacherPresences).forEach((k) => {
    if (now - (teacherPresences[k]?.lastPing || 0) > 90000) {
      delete teacherPresences[k];
    }
  });

  const connectedDevices: Record<string, any> = {
    ...(current.connectedDevices || {}),
    ...(incoming.connectedDevices || {}),
  };
  // Clean expired devices (> 90s)
  Object.keys(connectedDevices).forEach((k) => {
    if (now - (connectedDevices[k]?.lastPing || 0) > 90000) {
      delete connectedDevices[k];
    }
  });

  return {
    ...current,
    professors,
    activeProfessorId,
    classes,
    students,
    sessions,
    deletedSessionIds: mergedDeletedSessionIds,
    deletedProfessorIds: mergedDeletedProfessorIds,
    deletedStudentIds: mergedDeletedStudentIds,
    deletedClassIds: mergedDeletedClassIds,
    justifications,
    studentGrades,
    appSettings,
    selectedClassId,
    teacherPresences,
    connectedDevices,
    lastUpdated: newTs,
  };
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: "50mb" }));
  app.use(express.text({ type: ["text/*", "application/json"], limit: "50mb" }));

  const server = http.createServer(app);

  // WebSocket Server for instant multi-device live synchronization
  const wss = new WebSocketServer({ server, path: "/ws" });

  const broadcastDevices = () => {
    const payload = JSON.stringify({
      type: "DEVICES_UPDATED",
      devices: dbState.connectedDevices,
      totalConnected: wss.clients.size,
      timestamp: Date.now(),
    });
    wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(payload);
      }
    });
  };

  const broadcastState = (senderWs?: WebSocket, customType = "SYNC_STATE", senderClientId?: string) => {
    const payload = JSON.stringify({
      type: customType,
      state: dbState,
      senderClientId: senderClientId || `server-${Date.now()}`,
      timestamp: Date.now(),
    });

    wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN && client !== senderWs) {
        client.send(payload);
      }
    });
  };

  wss.on("connection", (ws) => {
    // Send current master state immediately upon connection
    ws.send(
      JSON.stringify({
        type: "SYNC_STATE",
        state: dbState,
        timestamp: Date.now(),
      })
    );

    ws.on("message", (rawMessage) => {
      try {
        const data = JSON.parse(rawMessage.toString());
        if (data.type === "PING") {
          ws.send(JSON.stringify({ type: "PONG", timestamp: Date.now() }));
        } else if (data.type === "DEVICE_HEARTBEAT" && data.device) {
          const dev = data.device;
          if (dev && dev.deviceId) {
            dbState.connectedDevices = {
              ...(dbState.connectedDevices || {}),
              [dev.deviceId]: {
                ...dev,
                lastPing: Date.now(),
                isOnline: true,
              },
            };
            broadcastDevices();
          }
        } else if (data.type === "GET_STATE") {
          ws.send(
            JSON.stringify({
              type: "SYNC_STATE",
              state: dbState,
              timestamp: Date.now(),
            })
          );
        } else if (data.type === "UPDATE_STATE" && data.state) {
          const senderClientId = data.state.senderClientId;
          dbState = mergeState(dbState, data.state);
          saveDatabase(dbState);
          broadcastState(ws, "STATE_UPDATED", senderClientId);
        } else if (data.type === "RESET_STATE") {
          dbState = getInitialDbState();
          saveDatabase(dbState, true);
          broadcastState(undefined, "SYNC_STATE");
        }
      } catch (err) {
        console.error("WebSocket message handling error:", err);
      }
    });
  });

  // REST API Routes
  app.get("/api/health", (req, res) => {
    res.json({
      status: "ok",
      connectedDevices: wss.clients.size,
      lastUpdated: dbState.lastUpdated,
    });
  });

  app.get("/api/devices", (req, res) => {
    const now = Date.now();
    const activeDevs = Object.values(dbState.connectedDevices || {}).filter(
      (d: any) => now - (d.lastPing || 0) <= 90000
    );
    res.json({
      success: true,
      devices: activeDevs,
      totalConnected: wss.clients.size,
    });
  });

  app.get("/api/sync/state", (req, res) => {
    const force = req.query.force === "1" || req.query.force === "true";
    const since = Number(req.query.since);
    if (!force && since && dbState.lastUpdated && dbState.lastUpdated <= since) {
      return res.json({
        success: true,
        notModified: true,
        lastUpdated: dbState.lastUpdated,
        connectedDevices: wss.clients.size,
        timestamp: Date.now(),
      });
    }

    res.json({
      success: true,
      notModified: false,
      state: dbState,
      lastUpdated: dbState.lastUpdated,
      connectedDevices: wss.clients.size,
      timestamp: Date.now(),
    });
  });

  app.post("/api/sync/state", (req, res) => {
    try {
      let updates = req.body;
      if (typeof updates === "string") {
        try {
          updates = JSON.parse(updates);
        } catch {
          // ignore
        }
      }
      if (updates && typeof updates === "object") {
        const senderClientId = updates.senderClientId;
        dbState = mergeState(dbState, updates);
        saveDatabase(dbState);
        broadcastState(undefined, "STATE_UPDATED", senderClientId);
        return res.json({ success: true, state: dbState });
      }
      return res.status(400).json({ error: "Invalid payload" });
    } catch (err) {
      console.error("Failed to update state via API:", err);
      return res.status(500).json({ error: "Internal server error" });
    }
  });

  // Dedicated endpoint for reliable single/batch session deletion
  app.post("/api/sessions/delete", (req, res) => {
    try {
      const { sessionId, sessionIds, classGroupId, all, senderClientId } = req.body || {};
      let idsToDelete: string[] = [];

      if (Array.isArray(sessionIds) && sessionIds.length > 0) {
        idsToDelete = sessionIds.map(String);
      } else if (sessionId) {
        idsToDelete = [String(sessionId)];
      } else if (all && classGroupId) {
        idsToDelete = (dbState.sessions || [])
          .filter((s: any) => s && s.classGroupId === classGroupId)
          .map((s: any) => s.id);
      }

      if (idsToDelete.length === 0) {
        return res.json({ success: true, message: "No sessions to delete", deletedCount: 0, state: dbState });
      }

      const toDeleteSet = new Set(idsToDelete);
      dbState.sessions = (dbState.sessions || []).filter((s: any) => s && !toDeleteSet.has(s.id));
      
      const newDeletedIds = Array.from(new Set([
        ...(dbState.deletedSessionIds || []),
        ...idsToDelete
      ]));
      dbState.deletedSessionIds = newDeletedIds;

      // Recalculate student statistics
      dbState.students = recalculateStudentStats(dbState.students, dbState.sessions);
      dbState.lastUpdated = Date.now();

      saveDatabase(dbState);
      broadcastState(undefined, "STATE_UPDATED", senderClientId);

      return res.json({
        success: true,
        deletedCount: idsToDelete.length,
        deletedSessionIds: idsToDelete,
        state: dbState
      });
    } catch (err) {
      console.error("Failed to delete session(s) via API:", err);
      return res.status(500).json({ error: "Failed to delete session(s)" });
    }
  });

  // Dedicated endpoint for reliable professor deletion
  app.post("/api/professors/delete", (req, res) => {
    try {
      const { professorId, senderClientId } = req.body || {};
      if (!professorId) {
        return res.status(400).json({ error: "professorId is required" });
      }
      if ((dbState.professors || []).length <= 1) {
        return res.status(400).json({ error: "Não é permitido excluir o único docente do sistema" });
      }
      const toDeleteId = String(professorId);

      // Check if professor has an active live session
      const hasLiveSession = (dbState.sessions || []).some(
        (s: any) => s && s.professorId === toDeleteId && s.isLive && !s.isLocked
      );
      if (hasLiveSession) {
        return res.status(400).json({ 
          error: "Não é possível excluir o docente enquanto houver aula/chamada ao vivo em andamento vinculada a ele." 
        });
      }

      dbState.professors = (dbState.professors || []).filter((p: any) => p && p.id !== toDeleteId);
      
      const newDeletedIds = Array.from(new Set([
        ...(dbState.deletedProfessorIds || []),
        toDeleteId
      ]));
      dbState.deletedProfessorIds = newDeletedIds;

      if (dbState.activeProfessorId === toDeleteId) {
        dbState.activeProfessorId = dbState.professors[0]?.id || "";
      }

      // Unassign professor from classes
      dbState.classes = (dbState.classes || []).map((cls: any) => {
        if (cls.professorId === toDeleteId) {
          return { ...cls, professorId: "", professorName: "Docente Não Definido" };
        }
        return cls;
      });

      dbState.lastUpdated = Date.now();
      saveDatabase(dbState);
      broadcastState(undefined, "STATE_UPDATED", senderClientId);

      return res.json({
        success: true,
        professorId: toDeleteId,
        state: dbState
      });
    } catch (err) {
      console.error("Failed to delete professor via API:", err);
      return res.status(500).json({ error: "Failed to delete professor" });
    }
  });

  // Dedicated endpoint for reliable single/batch student deletion
  app.post("/api/students/delete", (req, res) => {
    try {
      const { studentId, studentIds, classGroupId, all, senderClientId } = req.body || {};
      let idsToDelete: string[] = [];

      if (Array.isArray(studentIds) && studentIds.length > 0) {
        idsToDelete = studentIds.map(String);
      } else if (studentId) {
        idsToDelete = [String(studentId)];
      } else if (all && classGroupId) {
        idsToDelete = (dbState.students || [])
          .filter((s: any) => s && s.classGroupId === classGroupId)
          .map((s: any) => s.id);
      }

      if (idsToDelete.length === 0) {
        return res.json({ success: true, message: "No students to delete", deletedCount: 0, state: dbState });
      }

      const toDeleteSet = new Set(idsToDelete);
      dbState.students = (dbState.students || []).filter((s: any) => s && !toDeleteSet.has(s.id));
      
      const newDeletedIds = Array.from(new Set([
        ...(dbState.deletedStudentIds || []),
        ...idsToDelete
      ]));
      dbState.deletedStudentIds = newDeletedIds;

      // Clean attendance in sessions for deleted students
      if (Array.isArray(dbState.sessions)) {
        dbState.sessions = dbState.sessions.map((sess: any) => {
          if (sess && sess.attendance) {
            let changed = false;
            const newAtt = { ...sess.attendance };
            idsToDelete.forEach((id) => {
              if (newAtt[id]) {
                delete newAtt[id];
                changed = true;
              }
            });
            if (changed) {
              return { ...sess, attendance: newAtt };
            }
          }
          return sess;
        });
      }

      // Clean justifications
      if (Array.isArray(dbState.justifications)) {
        dbState.justifications = dbState.justifications.filter((j: any) => j && !toDeleteSet.has(j.studentId));
      }

      // Recalculate stats for remaining students
      dbState.students = recalculateStudentStats(dbState.students, dbState.sessions);
      dbState.lastUpdated = Date.now();

      saveDatabase(dbState);
      broadcastState(undefined, "STATE_UPDATED", senderClientId);

      return res.json({
        success: true,
        deletedCount: idsToDelete.length,
        deletedStudentIds: idsToDelete,
        state: dbState
      });
    } catch (err) {
      console.error("Failed to delete student(s) via API:", err);
      return res.status(500).json({ error: "Failed to delete student(s)" });
    }
  });

  // Dedicated endpoint to reset device binding for a student
  app.post("/api/students/reset-device-binding", (req, res) => {
    try {
      const { studentId, senderClientId } = req.body || {};
      if (!studentId) {
        return res.status(400).json({ error: "studentId is required" });
      }
      dbState.students = (dbState.students || []).map((s: any) => {
        if (s && s.id === studentId) {
          const updated = { ...s };
          delete updated.boundDeviceId;
          delete updated.deviceBoundAt;
          return updated;
        }
        return s;
      });
      dbState.lastUpdated = Date.now();
      saveDatabase(dbState);
      broadcastState(undefined, "STATE_UPDATED", senderClientId);
      return res.json({ success: true, message: "Vínculo de dispositivo redefinido", state: dbState });
    } catch (err) {
      console.error("Failed to reset student device binding:", err);
      return res.status(500).json({ error: "Failed to reset device binding" });
    }
  });

  // Dedicated endpoint to bind a device to a student (anti-fraud 1 device = 1 student)
  app.post("/api/students/bind-device", (req, res) => {
    try {
      const { studentId, registrationNumber, deviceId, senderClientId } = req.body || {};
      if (!deviceId) {
        return res.status(400).json({ error: "deviceId is required" });
      }

      // Check if device is bound to another student
      const boundToOther = (dbState.students || []).find((s: any) => 
        s && s.boundDeviceId === deviceId && 
        ((studentId && s.id !== studentId) || (registrationNumber && s.registrationNumber !== registrationNumber))
      );
      if (boundToOther) {
        return res.status(409).json({ 
          error: "Dispositivo Já Vinculado", 
          message: `Este aparelho já está vinculado ao aluno(a) "${boundToOther.name}" (RA: ${boundToOther.registrationNumber}).`
        });
      }

      let targetStudent = (dbState.students || []).find((s: any) => 
        (studentId && s.id === studentId) || (registrationNumber && s.registrationNumber === registrationNumber)
      );

      if (!targetStudent) {
        return res.status(404).json({ error: "Aluno não encontrado para vincular dispositivo" });
      }

      if (targetStudent.boundDeviceId && targetStudent.boundDeviceId !== deviceId) {
        return res.status(403).json({
          error: "Aparelho Não Autorizado",
          message: `O aluno(a) ${targetStudent.name} (RA: ${targetStudent.registrationNumber}) já está vinculado a outro celular.`
        });
      }

      const boundAt = new Date().toISOString();
      dbState.students = (dbState.students || []).map((s: any) => {
        if (s && s.id === targetStudent.id) {
          return {
            ...s,
            boundDeviceId: deviceId,
            deviceBoundAt: boundAt
          };
        }
        return s;
      });

      dbState.lastUpdated = Date.now();
      saveDatabase(dbState);
      broadcastState(undefined, "STATE_UPDATED", senderClientId);
      return res.json({ 
        success: true, 
        message: `Dispositivo vinculado com sucesso ao aluno(a) ${targetStudent.name}`, 
        student: { ...targetStudent, boundDeviceId: deviceId, deviceBoundAt: boundAt }
      });
    } catch (err) {
      console.error("Failed to bind device to student:", err);
      return res.status(500).json({ error: "Failed to bind device" });
    }
  });

  // Dedicated endpoint for reliable class deletion
  app.post("/api/classes/delete", (req, res) => {
    try {
      const { classId, deleteAssociatedStudents, senderClientId } = req.body || {};
      if (!classId) {
        return res.status(400).json({ error: "classId is required" });
      }
      const toDeleteClassId = String(classId);
      dbState.classes = (dbState.classes || []).filter((c: any) => c && c.id !== toDeleteClassId);
      dbState.deletedClassIds = Array.from(new Set([...(dbState.deletedClassIds || []), toDeleteClassId]));

      if (deleteAssociatedStudents) {
        const removedStudents = (dbState.students || []).filter((s: any) => s && s.classGroupId === toDeleteClassId);
        const removedStudentIds = removedStudents.map((s: any) => s.id);
        const removedStudentSet = new Set(removedStudentIds);
        dbState.students = (dbState.students || []).filter((s: any) => s && !removedStudentSet.has(s.id));
        dbState.deletedStudentIds = Array.from(new Set([...(dbState.deletedStudentIds || []), ...removedStudentIds]));

        if (Array.isArray(dbState.justifications)) {
          dbState.justifications = dbState.justifications.filter((j: any) => j && !removedStudentSet.has(j.studentId));
        }
      }

      // Also remove sessions for this class
      const removedSessions = (dbState.sessions || []).filter((s: any) => s && s.classGroupId === toDeleteClassId);
      const removedSessionIds = removedSessions.map((s: any) => s.id);
      dbState.sessions = (dbState.sessions || []).filter((s: any) => s && s.classGroupId !== toDeleteClassId);
      dbState.deletedSessionIds = Array.from(new Set([...(dbState.deletedSessionIds || []), ...removedSessionIds]));

      dbState.students = recalculateStudentStats(dbState.students, dbState.sessions);
      dbState.lastUpdated = Date.now();

      saveDatabase(dbState);
      broadcastState(undefined, "STATE_UPDATED", senderClientId);

      return res.json({ success: true, state: dbState });
    } catch (err) {
      console.error("Failed to delete class via API:", err);
      return res.status(500).json({ error: "Failed to delete class" });
    }
  });

  app.post("/api/attendance/checkin", (req, res) => {
    try {
      const { 
        registrationNumber, 
        studentId, 
        sessionId, 
        classGroupId, 
        deviceId, 
        checkinMethod = 'qrcode',
        period,
        allowOtherClass = false
      } = req.body || {};

      const cleanInput = (registrationNumber || '').toString().trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
      const cleanInputNoPrefix = cleanInput.replace(/^RA/i, '');
      const cleanInputNoZero = cleanInputNoPrefix.replace(/^0+/, '');

      // Find student strictly in database
      let student = dbState.students.find((s: any) => {
        if (studentId && s.id === studentId) return true;
        const cleanDb = (s.registrationNumber || '').toString().trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
        if (cleanDb === cleanInput) return true;
        const cleanDbNoPrefix = cleanDb.replace(/^RA/i, '');
        if (cleanDbNoPrefix && cleanInputNoPrefix && cleanDbNoPrefix === cleanInputNoPrefix) return true;
        const cleanDbNoZero = cleanDbNoPrefix.replace(/^0+/, '');
        return cleanDbNoZero.length > 0 && cleanInputNoZero.length > 0 && cleanDbNoZero === cleanInputNoZero;
      });

      if (!student) {
        return res.json({
          success: false,
          notFound: true,
          message: `RA / Matrícula "${registrationNumber || cleanInput}" não foi localizado na base de alunos cadastrados nesta turma. Verifique os números ou solicite cadastro ao docente.`
        });
      }

      // Intelligent target session resolution
      let targetSession: any = null;

      if (sessionId) {
        // If specific session requested:
        if ((dbState.deletedSessionIds || []).includes(sessionId)) {
          return res.status(410).json({ 
            success: false, 
            sessionDeleted: true, 
            message: 'Esta aula/chamada foi excluída pelo docente e não está mais ativa.' 
          });
        }

        let foundSession = (dbState.sessions || []).find((s: any) => s.id === sessionId);
        
        // If not found by exact ID, find any active live session for this class or student
        if (!foundSession) {
          foundSession = (dbState.sessions || []).find((s: any) => 
            s.isLive && !s.isLocked && (s.classGroupId === classGroupId || s.classGroupId === student.classGroupId || s.classGroupId === dbState.selectedClassId)
          );
        }

        // If still not found, check for any live session anywhere
        if (!foundSession) {
          foundSession = (dbState.sessions || []).find((s: any) => s.isLive && !s.isLocked);
        }

        // If still not found, dynamically initialize this new session so check-in is never rejected with 404
        if (!foundSession) {
          const targetClassId = classGroupId || student.classGroupId || dbState.selectedClassId || 'class-bmf4-turmab';
          const targetClassObj = (dbState.classes || []).find((c: any) => c.id === targetClassId);
          const newSessionObj = {
            id: sessionId,
            classGroupId: targetClassId,
            discipline: 'BMF4',
            date: new Date().toISOString().split('T')[0],
            topic: 'Aula BMF4 - Morfofuncional',
            activityCategory: 'pratica',
            activityType: 'aula_pratica',
            activePeriod: period || '1',
            isLive: true,
            isLocked: false,
            isPaused: false,
            startTime: '07:30',
            endTime: '12:00',
            professorName: (dbState.professors?.find((p: any) => p.id === dbState.activeProfessorId)?.name || targetClassObj?.professorName || 'Docente BMF4'),
            attendance: {},
          };
          dbState.sessions = [newSessionObj, ...(dbState.sessions || [])];
          foundSession = newSessionObj;
        }

        if (foundSession.isLocked || !foundSession.isLive) {
          // Check if there is a newer active session for this class
          const newerActive = (dbState.sessions || []).find((s: any) => 
            (s.classGroupId === foundSession.classGroupId || s.classGroupId === student.classGroupId) &&
            s.isLive && !s.isLocked
          );
          if (newerActive) {
            foundSession = newerActive;
          } else {
            return res.status(403).json({ 
              success: false, 
              sessionLocked: true, 
              message: 'A chamada desta aula já foi encerrada e bloqueada pelo docente.' 
            });
          }
        }

        targetSession = foundSession;
      } else {
        // No specific sessionId provided, look for active live session in student class or selected class
        targetSession = (dbState.sessions || []).find((s: any) => 
          s.isLive && !s.isLocked && (s.classGroupId === student.classGroupId || s.classGroupId === classGroupId || s.classGroupId === dbState.selectedClassId)
        );

        if (!targetSession) {
          targetSession = (dbState.sessions || []).find((s: any) => s.isLive && !s.isLocked);
        }
      }

      const todayStr = new Date().toISOString().split('T')[0];

      if (!targetSession) {
        const targetClassId = classGroupId || student.classGroupId || dbState.selectedClassId || dbState.classes?.[0]?.id || 'class-bmf4-turmab';
        const targetClassObj = (dbState.classes || []).find((c: any) => c.id === targetClassId);
        targetSession = {
          id: sessionId || `session-auto-${Date.now()}`,
          classGroupId: targetClassId,
          discipline: targetClassObj?.discipline || 'BMF4',
          date: new Date().toISOString().split('T')[0],
          topic: targetClassObj?.name ? `Aula - ${targetClassObj.name}` : 'Aula Prática / Teórica BMF4',
          activityCategory: 'pratica',
          activityType: 'aula_pratica',
          activePeriod: period || '1',
          isLive: true,
          isLocked: false,
          isPaused: false,
          startTime: '07:30',
          endTime: '12:00',
          professorName: (dbState.professors?.find((p: any) => p.id === dbState.activeProfessorId)?.name || targetClassObj?.professorName || 'Docente Responsável'),
          attendance: {},
        };
        dbState.sessions = [targetSession, ...(dbState.sessions || [])];
      }

      // Always force session to be live and unlocked during student check-in
      targetSession.isLive = true;
      targetSession.isLocked = false;
      targetSession.isPaused = false;

      const isOtherClass = student.classGroupId !== targetSession.classGroupId;
      if (isOtherClass && !allowOtherClass) {
        const studentClass = dbState.classes.find((c: any) => c.id === student.classGroupId);
        const targetClass = dbState.classes.find((c: any) => c.id === targetSession.classGroupId);
        return res.json({
          success: false,
          needsOtherClassConfirmation: true,
          student,
          studentClassName: studentClass?.name || 'Outra Turma',
          targetClassName: targetClass?.name || 'Turma Atual',
          message: `Aluno matriculado na ${studentClass?.name || 'outra turma'}. Confirma presença como reposição/turma cruzada?`
        });
      }

      // Strict Device Binding Anti-Fraud
      if (deviceId) {
        // Check 1: Is this device already bound to another student?
        const boundToOther = (dbState.students || []).find((s: any) => s.id !== student.id && s.boundDeviceId && s.boundDeviceId === deviceId);
        if (boundToOther) {
          return res.json({
            success: false,
            deviceBlocked: true,
            message: `Dispositivo Já Vinculado: Este aparelho está vinculado exclusivamente ao aluno(a) "${boundToOther.name}" (RA: ${boundToOther.registrationNumber}). Não é permitido registrar presença para outros estudantes no mesmo celular.`
          });
        }

        // Check 2: Is this student bound to a different device?
        if (student.boundDeviceId && student.boundDeviceId !== deviceId) {
          return res.json({
            success: false,
            deviceBlocked: true,
            message: `Segurança Institucional: O aluno(a) ${student.name} (RA: ${student.registrationNumber}) está vinculado a outro aparelho celular. Cada estudante deve utilizar sempre o seu próprio dispositivo.`
          });
        }

        // Check 3: Bind student to this device if not yet bound
        if (!student.boundDeviceId) {
          student.boundDeviceId = deviceId;
          student.deviceBoundAt = new Date().toISOString();
          dbState.students = dbState.students.map((s: any) => s.id === student.id ? { ...s, boundDeviceId: deviceId, deviceBoundAt: student.deviceBoundAt } : s);
          saveDatabase(dbState);
        }
      }

      const now = new Date();
      const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;
      const currentPeriod = period || targetSession.activePeriod || 'both';

      // Look up existing record by ID or RA in targetSession
      const existingRec = targetSession.attendance?.[student.id] || 
        Object.values(targetSession.attendance || {}).find((r: any) => 
          r && (r.studentId === student.id || r.registrationNumber === student.registrationNumber || r.studentRa === student.registrationNumber)
        );

      // Strict check: Student must confirm presence per period
      let isAlreadyPresent = false;
      if (existingRec) {
        if (currentPeriod === '1' || currentPeriod === 'p1_start' || currentPeriod === 'p1_end') {
          isAlreadyPresent = existingRec.period1Status === 'present' || existingRec.p1StartStatus === 'present' || existingRec.p1EndStatus === 'present';
        } else if (currentPeriod === '2' || currentPeriod === 'p2_start' || currentPeriod === 'p2_end') {
          isAlreadyPresent = existingRec.period2Status === 'present' || existingRec.p2StartStatus === 'present' || existingRec.p2EndStatus === 'present';
        } else {
          isAlreadyPresent = existingRec.status === 'present' || (existingRec.period1Status === 'present' && existingRec.period2Status === 'present');
        }
      }

      if (isAlreadyPresent) {
        return res.json({
          success: false,
          alreadyPresent: true,
          student,
          existingRecord: existingRec,
          message: `Presença já confirmada anteriormente! O aluno(a) ${student.name} (RA: ${student.registrationNumber}) já possui presença registrada nesta chamada aberta. Cada aluno deve confirmar a presença somente uma vez.`
        });
      }

      let newPeriod1 = existingRec?.period1Status || 'absent';
      let newPeriod2 = existingRec?.period2Status || 'absent';
      let newP1Start = existingRec?.p1StartStatus || 'absent';
      let newP1End = existingRec?.p1EndStatus || 'absent';
      let newP2Start = existingRec?.p2StartStatus || 'absent';
      let newP2End = existingRec?.p2EndStatus || 'absent';

      let newP1StartTime = existingRec?.p1StartTimestamp;
      let newP1EndTime = existingRec?.p1EndTimestamp;
      let newP2StartTime = existingRec?.p2StartTimestamp;
      let newP2EndTime = existingRec?.p2EndTimestamp;
      let newP1Time = existingRec?.period1Timestamp;
      let newP2Time = existingRec?.period2Timestamp;

      if (currentPeriod === 'p1_start') {
        newP1Start = 'present';
        newP1StartTime = timeStr;
        newPeriod1 = 'present';
        newP1Time = timeStr;
      } else if (currentPeriod === 'p1_end') {
        newP1End = 'present';
        newP1EndTime = timeStr;
        newPeriod1 = 'present';
        newP1Time = newP1Time || timeStr;
      } else if (currentPeriod === 'p2_start') {
        newP2Start = 'present';
        newP2StartTime = timeStr;
        newPeriod2 = 'present';
        newP2Time = timeStr;
      } else if (currentPeriod === 'p2_end') {
        newP2End = 'present';
        newP2EndTime = timeStr;
        newPeriod2 = 'present';
        newP2Time = newP2Time || timeStr;
      } else if (currentPeriod === '1') {
        newPeriod1 = 'present';
        newP1Start = 'present';
        newP1End = 'present';
        newP1StartTime = newP1StartTime || timeStr;
        newP1EndTime = timeStr;
        newP1Time = timeStr;
      } else if (currentPeriod === '2') {
        newPeriod2 = 'present';
        newP2Start = 'present';
        newP2End = 'present';
        newP2StartTime = newP2StartTime || timeStr;
        newP2EndTime = timeStr;
        newP2Time = timeStr;
      } else {
        newPeriod1 = 'present';
        newPeriod2 = 'present';
        newP1Start = 'present';
        newP1End = 'present';
        newP2Start = 'present';
        newP2End = 'present';
        newP1StartTime = newP1StartTime || timeStr;
        newP1EndTime = timeStr;
        newP2StartTime = newP2StartTime || timeStr;
        newP2EndTime = timeStr;
        newP1Time = timeStr;
        newP2Time = timeStr;
      }

      const cleanStudentRa = (student.registrationNumber || '').replace(/\D/g, '');
      const updatedRecord = {
        studentId: student.id,
        studentName: student.name,
        studentRa: student.registrationNumber,
        status: 'present',
        period1Status: newPeriod1,
        period2Status: newPeriod2,
        p1StartStatus: newP1Start,
        p1EndStatus: newP1End,
        p2StartStatus: newP2Start,
        p2EndStatus: newP2End,
        p1StartTimestamp: newP1StartTime,
        p1EndTimestamp: newP1EndTime,
        p2StartTimestamp: newP2StartTime,
        p2EndTimestamp: newP2EndTime,
        period1Timestamp: newP1Time,
        period2Timestamp: newP2Time,
        timestamp: (currentPeriod === '2' || currentPeriod === 'p2_start' || currentPeriod === 'p2_end')
          ? (newP2Time || timeStr)
          : (newP1Time || existingRec?.timestamp || timeStr),
        epiVerified: true,
        checkinMethod: checkinMethod,
        deviceId: deviceId || existingRec?.deviceId,
        isVerifiedLive: true,
      };

      const updatedSessions = dbState.sessions.map((s: any) => {
        if (s.id === targetSession.id) {
          const newAtt = {
            ...s.attendance,
            [student.id]: updatedRecord,
          };
          if (student.registrationNumber) {
            newAtt[student.registrationNumber] = updatedRecord;
          }
          if (cleanStudentRa && cleanStudentRa !== student.registrationNumber) {
            newAtt[cleanStudentRa] = updatedRecord;
          }
          const currentVer = typeof s.version === 'number' ? s.version : 0;
          return {
            ...s,
            attendance: newAtt,
            version: currentVer + 1,
            lastUpdateTimestamp: Date.now(),
          };
        }
        return s;
      });

      dbState.sessions = updatedSessions;
      dbState.students = recalculateStudentStats(dbState.students, updatedSessions);
      dbState.lastUpdated = Date.now();
      saveDatabase(dbState);

      // 1. Send dedicated CHECKIN_CONFIRMED with zero-latency payload
      const checkinConfirmMsg = JSON.stringify({
        type: "CHECKIN_CONFIRMED",
        studentId: student.id,
        studentName: student.name,
        studentRa: student.registrationNumber,
        student,
        sessionId: targetSession.id,
        classGroupId: targetSession.classGroupId,
        record: updatedRecord,
        state: dbState,
        senderClientId: `server-checkin-${Date.now()}`,
        timestamp: Date.now(),
      });
      wss.clients.forEach((c) => {
        if (c.readyState === WebSocket.OPEN) {
          c.send(checkinConfirmMsg);
        }
      });

      // 2. Broadcast general updated state
      broadcastState(undefined, "STATE_UPDATED", req.body?.senderClientId);

      return res.json({
        success: true,
        message: `Presença confirmada com sucesso para ${student.name}!`,
        student,
        session: targetSession,
        record: updatedRecord,
      });
    } catch (err: any) {
      console.error("Attendance checkin error:", err);
      return res.status(500).json({ success: false, message: 'Erro interno ao processar presença.' });
    }
  });

  // Outbox Offline Attendance Queue Processor
  app.post("/api/outbox/process", (req, res) => {
    try {
      const { items, senderClientId } = req.body || {};
      if (!Array.isArray(items) || items.length === 0) {
        return res.json({ success: true, processedCount: 0, message: "Nenhum item para processar." });
      }

      let modifiedSessions = false;
      const updatedSessions = [...dbState.sessions];

      items.forEach((item: any) => {
        if (!item || !item.sessionId) return;

        const sessionIndex = updatedSessions.findIndex((s: any) => s.id === item.sessionId);
        if (sessionIndex === -1) return;

        const targetSession = { ...updatedSessions[sessionIndex] };
        targetSession.attendance = { ...(targetSession.attendance || {}) };

        if (item.eventType === 'RECORD_ATTENDANCE' && item.studentId) {
          const existingRec = targetSession.attendance[item.studentId] || {};
          const studentRec = item.payload?.record || {
            studentId: item.studentId,
            status: item.status || 'present',
            period1Status: item.payload?.period1Status || (item.period === '2' ? 'absent' : (item.status || 'present')),
            period2Status: item.payload?.period2Status || (item.period === '1' ? 'absent' : (item.status || 'present')),
            p1StartStatus: item.payload?.p1StartStatus,
            p1EndStatus: item.payload?.p1EndStatus,
            p2StartStatus: item.payload?.p2StartStatus,
            p2EndStatus: item.payload?.p2EndStatus,
            timestamp: item.timestamp || new Date().toISOString(),
            epiVerified: item.payload?.epiVerified ?? true,
            checkinMethod: item.payload?.checkinMethod || 'offline_outbox',
            deviceId: item.deviceId || existingRec.deviceId,
            isVerifiedLive: true,
          };

          targetSession.attendance[item.studentId] = {
            ...existingRec,
            ...studentRec,
          };
          targetSession.version = (typeof targetSession.version === 'number' ? targetSession.version : 0) + 1;
          targetSession.lastUpdateTimestamp = Date.now();
          updatedSessions[sessionIndex] = targetSession;
          modifiedSessions = true;
        } else if (item.eventType === 'BATCH_ATTENDANCE' && item.payload?.attendance) {
          targetSession.attendance = {
            ...targetSession.attendance,
            ...item.payload.attendance,
          };
          targetSession.version = (typeof targetSession.version === 'number' ? targetSession.version : 0) + 1;
          targetSession.lastUpdateTimestamp = Date.now();
          updatedSessions[sessionIndex] = targetSession;
          modifiedSessions = true;
        } else if (item.eventType === 'EXCUSE_STUDENT' && item.studentId) {
          const existingRec = targetSession.attendance[item.studentId] || {};
          targetSession.attendance[item.studentId] = {
            ...existingRec,
            studentId: item.studentId,
            status: 'excused',
            period1Status: 'excused',
            period2Status: 'excused',
            justificationReason: item.payload?.reason || 'Justificativa de Falta',
            justificationFileUrl: item.payload?.fileUrl,
            justificationFileName: item.payload?.fileName,
            timestamp: item.timestamp,
          };
          targetSession.version = (typeof targetSession.version === 'number' ? targetSession.version : 0) + 1;
          targetSession.lastUpdateTimestamp = Date.now();
          updatedSessions[sessionIndex] = targetSession;
          modifiedSessions = true;
        }
      });

      if (modifiedSessions) {
        dbState.sessions = updatedSessions;
        dbState.students = recalculateStudentStats(dbState.students, updatedSessions);
        dbState.lastUpdated = Date.now();
        saveDatabase(dbState);
        broadcastState(undefined, "STATE_UPDATED", senderClientId);
      }

      return res.json({
        success: true,
        processedCount: items.length,
        message: `${items.length} marcações da fila Outbox sincronizadas com sucesso.`,
      });
    } catch (err: any) {
      console.error("Outbox process error:", err);
      return res.status(500).json({ success: false, message: "Erro ao processar fila outbox." });
    }
  });

  app.post("/api/session/delete", (req, res) => {
    try {
      const { sessionId, deletedSessionIds = [], senderClientId } = req.body || {};
      if (!sessionId) {
        return res.status(400).json({ success: false, message: "ID da sessão é obrigatório" });
      }

      const mergedDeleted = Array.from(new Set([
        ...(dbState.deletedSessionIds || []),
        ...(Array.isArray(deletedSessionIds) ? deletedSessionIds : []),
        sessionId,
      ]));

      dbState.deletedSessionIds = mergedDeleted;
      dbState.sessions = (dbState.sessions || []).filter((s: any) => s && s.id !== sessionId && !mergedDeleted.includes(s.id));
      dbState.students = recalculateStudentStats(dbState.students, dbState.sessions);
      dbState.lastUpdated = Date.now();
      saveDatabase(dbState);
      broadcastState(undefined, "STATE_UPDATED", senderClientId);

      return res.json({ success: true, message: "Chamada/relatório excluído com sucesso", deletedSessionId: sessionId });
    } catch (err: any) {
      console.error("Error deleting session:", err);
      return res.status(500).json({ success: false, message: "Erro ao excluir chamada" });
    }
  });

  app.post("/api/session/delete-all", (req, res) => {
    try {
      const { classGroupId, deletedSessionIds = [], senderClientId } = req.body || {};
      if (!classGroupId) {
        return res.status(400).json({ success: false, message: "ID da turma é obrigatório" });
      }

      const sessionsToDelete = (dbState.sessions || []).filter((s: any) => s && s.classGroupId === classGroupId);
      const idsToDelete = sessionsToDelete.map((s: any) => s.id);

      const mergedDeleted = Array.from(new Set([
        ...(dbState.deletedSessionIds || []),
        ...(Array.isArray(deletedSessionIds) ? deletedSessionIds : []),
        ...idsToDelete,
      ]));

      dbState.deletedSessionIds = mergedDeleted;
      dbState.sessions = (dbState.sessions || []).filter((s: any) => s && s.classGroupId !== classGroupId && !mergedDeleted.includes(s.id));
      dbState.students = recalculateStudentStats(dbState.students, dbState.sessions);
      dbState.lastUpdated = Date.now();
      saveDatabase(dbState);
      broadcastState(undefined, "STATE_UPDATED", senderClientId);

      return res.json({ success: true, message: `Todas as chamadas da turma foram excluídas`, deletedCount: idsToDelete.length });
    } catch (err: any) {
      console.error("Error deleting all sessions for class:", err);
      return res.status(500).json({ success: false, message: "Erro ao excluir chamadas da turma" });
    }
  });

  app.post("/api/sync/reset", (req, res) => {
    dbState = {
      ...getInitialDbState(),
      lastUpdated: Date.now(),
    };
    saveDatabase(dbState);
    const payload = JSON.stringify({
      type: "SYNC_STATE",
      state: {
        ...dbState,
        isExplicitReset: true,
      },
      senderClientId: req.body?.senderClientId,
      timestamp: Date.now(),
    });

    wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(payload);
      }
    });
    res.json({ success: true, message: "Banco de dados zerado com sucesso (em branco)", state: dbState });
  });

  // Dedicated in-memory buffer of latest automatic QR code email dispatches (persisting latest 50)
  const latestEmailDispatches: any[] = [];

  // Automatic Email Dispatch for Dynamic QR Code Cycles to Fixed Recipient chamadabmf4@gmail.com
  app.post("/api/email/auto-send-qrcode", async (req, res) => {
    try {
      const {
        cycleNumber = 1,
        token = "",
        securityHash = "",
        sessionId = "",
        classGroupId = "",
        className = "BMF4 Medicina",
        topic = "Bases Morfofuncionais 4",
        period = "1",
        professorName = "Docente Responsável",
        durationSeconds = 45,
        studentUrl = "",
        telaoUrl = "",
        qrDataUrl = "",
        timestamp = Date.now(),
      } = req.body || {};

      // Fixed pre-specified target email address
      const targetEmail = "chamadabmf4@gmail.com";
      const timeFormatted = new Date(timestamp).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
      const dateFormatted = new Date(timestamp).toLocaleDateString("pt-BR");
      const subject = `[BMF4 Medicina] QR Code Dinâmico - Ciclo #${cycleNumber} (${token}) - Turma ${className}`;

      const textContent = `UNINOVE MEDICINA - PRESENÇA BMF4
Envio Automático do Ciclo #${cycleNumber} do QR Code Dinâmico

Destinatário: ${targetEmail}
Turma: ${className}
Disciplina: ${topic}
Etapa: ${period === '2' ? 'Etapa 2 (Segunda Metade)' : 'Etapa 1 (Início da Aula)'}
Docente: ${professorName}
Token de Validação: ${token}
Tempo de Exibição: ${durationSeconds} segundos
Data: ${dateFormatted} às ${timeFormatted}

📺 LINK DO MODO TELÃO (Smart TV / Projetor):
${telaoUrl}

📱 LINK DE CHECK-IN DO ALUNO:
${studentUrl}

Este e-mail foi disparado automaticamente pelo sistema de presença BMF4 assim que o ciclo do QR code foi gerado/rotacionado no sistema.`;

      const htmlContent = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 620px; margin: 0 auto; background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05);">
        <div style="background: linear-gradient(135deg, #0f172a 0%, #0369a1 100%); padding: 24px 20px; text-align: center; color: #ffffff;">
          <p style="text-transform: uppercase; letter-spacing: 0.1em; font-size: 11px; font-weight: 700; color: #7dd3fc; margin: 0 0 6px 0;">Universidade Nove de Julho • Medicina</p>
          <h1 style="font-size: 20px; font-weight: 800; margin: 0; color: #ffffff;">Presença BMF4 — QR Code Dinâmico</h1>
          <div style="display: inline-block; background-color: rgba(255,255,255,0.15); border: 1px solid rgba(255,255,255,0.25); border-radius: 20px; padding: 4px 14px; margin-top: 10px;">
            <span style="color: #e0f2fe; font-size: 12px; font-weight: 700;">🔄 Ciclo Dinâmico #${cycleNumber} • Atualizado às ${timeFormatted}</span>
          </div>
        </div>

        <div style="padding: 24px 20px;">
          <div style="text-align: center; margin-bottom: 24px;">
            ${qrDataUrl ? `
              <div style="display: inline-block; padding: 12px; background: #ffffff; border: 3px solid #0284c7; border-radius: 16px; box-shadow: 0 4px 12px rgba(2, 132, 199, 0.15);">
                <img src="${qrDataUrl}" alt="QR Code Dinâmico Ciclo ${cycleNumber}" style="display: block; width: 260px; height: 260px; max-width: 100%; margin: 0 auto;" />
              </div>
            ` : ''}
            <div style="margin-top: 12px;">
              <span style="font-size: 11px; color: #64748b; text-transform: uppercase; font-weight: 600; display: block;">Token Dinâmico da Sessão</span>
              <span style="font-family: monospace; font-size: 22px; font-weight: 900; color: #0369a1; letter-spacing: 2px;">${token}</span>
            </div>
          </div>

          <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 16px; margin-bottom: 20px;">
            <h3 style="margin: 0 0 12px 0; font-size: 13px; font-weight: 700; color: #0f172a; text-transform: uppercase; letter-spacing: 0.05em; border-bottom: 1px solid #e2e8f0; padding-bottom: 6px;">
              📋 Informações da Aula
            </h3>
            <table style="width: 100%; font-size: 13px; color: #334155; border-collapse: collapse;">
              <tr><td style="padding: 4px 0; font-weight: 600; width: 40%;">Turma:</td><td style="padding: 4px 0;">${className}</td></tr>
              <tr><td style="padding: 4px 0; font-weight: 600;">Disciplina:</td><td style="padding: 4px 0;">${topic}</td></tr>
              <tr><td style="padding: 4px 0; font-weight: 600;">Etapa:</td><td style="padding: 4px 0;">${period === '2' ? 'Etapa 2 (Segunda Metade)' : 'Etapa 1 (Início da Aula)'}</td></tr>
              <tr><td style="padding: 4px 0; font-weight: 600;">Docente:</td><td style="padding: 4px 0;">${professorName}</td></tr>
              <tr><td style="padding: 4px 0; font-weight: 600;">Data / Horário:</td><td style="padding: 4px 0;">${dateFormatted} às ${timeFormatted}</td></tr>
              <tr><td style="padding: 4px 0; font-weight: 600;">Duração do Ciclo:</td><td style="padding: 4px 0;">${durationSeconds} segundos (tempo estendido para leitura)</td></tr>
            </table>
          </div>

          <div style="text-align: center; margin-bottom: 16px;">
            <a href="${telaoUrl}" target="_blank" style="display: block; background: #0284c7; color: #ffffff; text-decoration: none; font-weight: 700; font-size: 14px; padding: 14px 20px; border-radius: 12px; box-shadow: 0 4px 6px -1px rgba(2, 132, 199, 0.3);">
              📺 Abrir Modo Telão (Smart TV / Projetor)
            </a>
          </div>
        </div>

        <div style="background-color: #f1f5f9; border-top: 1px solid #e2e8f0; padding: 16px 20px; text-align: center;">
          <p style="margin: 0; font-size: 11px; color: #64748b; line-height: 1.5;">
            Disparo automático para <strong>${targetEmail}</strong> • Sistema de Presença BMF4 Medicina UNINOVE.
          </p>
        </div>
      </div>
      `;

      let deliveredViaSmtp = false;
      let smtpError: string | null = null;

      const smtpHost = process.env.SMTP_HOST || "";
      const smtpPort = Number(process.env.SMTP_PORT) || 465;
      const smtpUser = process.env.SMTP_USER || process.env.GMAIL_USER || "";
      const smtpPass = process.env.SMTP_PASS || process.env.GMAIL_APP_PASSWORD || "";

      if ((smtpHost && smtpUser && smtpPass) || (smtpUser && smtpPass)) {
        try {
          const transporter = smtpHost
            ? nodemailer.createTransport({
                host: smtpHost,
                port: smtpPort,
                secure: smtpPort === 465,
                auth: { user: smtpUser, pass: smtpPass },
              })
            : nodemailer.createTransport({
                service: "gmail",
                auth: { user: smtpUser, pass: smtpPass },
              });

          await transporter.sendMail({
            from: `"Presença BMF4 Medicina" <${smtpUser}>`,
            to: targetEmail,
            subject,
            text: textContent,
            html: htmlContent,
          });
          deliveredViaSmtp = true;
          console.log(`[AUTO-EMAIL] Enviado com sucesso via SMTP para ${targetEmail} (Ciclo #${cycleNumber}, Token: ${token})`);
        } catch (mailErr: any) {
          smtpError = mailErr?.message || String(mailErr);
          console.warn(`[AUTO-EMAIL] Falha no transporte SMTP para ${targetEmail}:`, smtpError);
        }
      } else {
        console.log(`[AUTO-EMAIL REGISTRADO] Ciclo #${cycleNumber} do QR Code despachado para ${targetEmail} (Token: ${token})`);
      }

      const dispatchRecord = {
        id: `dispatch-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        cycleNumber,
        token,
        securityHash,
        recipient: targetEmail,
        className,
        topic,
        period,
        sentAt: timestamp,
        sentAtFormatted: `${dateFormatted} às ${timeFormatted}`,
        deliveredViaSmtp,
        smtpError,
        status: "sent",
        telaoUrl,
      };

      latestEmailDispatches.unshift(dispatchRecord);
      if (latestEmailDispatches.length > 50) {
        latestEmailDispatches.pop();
      }

      return res.json({
        success: true,
        message: `QR Code do ciclo #${cycleNumber} enviado automaticamente para ${targetEmail}`,
        dispatch: dispatchRecord,
      });
    } catch (err: any) {
      console.error("Erro no processamento do envio automático de QR Code por e-mail:", err);
      return res.status(500).json({
        success: false,
        message: "Erro ao processar envio automático de e-mail",
        error: err?.message,
      });
    }
  });

  app.get("/api/email/latest-dispatches", (req, res) => {
    res.json({
      success: true,
      recipient: "chamadabmf4@gmail.com",
      totalDispatches: latestEmailDispatches.length,
      latest: latestEmailDispatches[0] || null,
      history: latestEmailDispatches.slice(0, 10),
    });
  });

  // Vite middleware in dev or Static files in prod
  const distPath = path.join(process.cwd(), "dist");
  const hasDist = fs.existsSync(distPath) && fs.existsSync(path.join(distPath, "index.html"));

  if (process.env.NODE_ENV === "production" || hasDist) {
    app.use(express.static(distPath, {
      setHeaders: (res, filePath) => {
        // Prevent browser/PWA from caching sw.js, manifest.json and html files
        if (filePath.endsWith("sw.js") || filePath.endsWith("manifest.json") || filePath.endsWith(".html")) {
          res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
          res.setHeader("Pragma", "no-cache");
          res.setHeader("Expires", "0");
        }
      }
    }));
    app.get("*", (req, res) => {
      res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
      res.sendFile(path.join(distPath, "index.html"));
    });
  } else {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  }

  console.log("A tentar iniciar o servidor na porta:", PORTA);
  server.listen(PORTA, "0.0.0.0", () => {
    console.log(`Servidor BMF4 em tempo real em execução em http://0.0.0.0:${PORTA}`);
  });
}

startServer();

