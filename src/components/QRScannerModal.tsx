import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  X, 
  Camera, 
  CheckCircle2, 
  AlertTriangle, 
  QrCode, 
  ShieldCheck, 
  UserPlus,
  Search, 
  UserCheck, 
  Sparkles, 
  Barcode, 
  Flashlight, 
  RefreshCw, 
  Smartphone, 
  Check,
  Upload,
  Zap,
  RotateCcw,
  Loader2
} from 'lucide-react';
import jsQR from 'jsqr';
import { useLab } from '../context/LabContext';
import { Student } from '../types';
import { StudentAvatar } from './StudentAvatar';

interface QRScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const QRScannerModal: React.FC<QRScannerModalProps> = ({
  isOpen,
  onClose,
}) => {
  const { 
    students, 
    selectedClassId, 
    activeSession, 
    studentSelfCheckin, 
    setAttendanceStatus,
    selfRegisterAndCheckin,
    classes,
    dynamicToken,
    playBeep,
  } = useLab();

  const [mode, setMode] = useState<'camera' | 'manual' | 'register'>('camera');
  const [raInput, setRaInput] = useState('');
  const [codeInput, setCodeInput] = useState(dynamicToken || activeSession?.checkinCode || '');
  const [epiChecked, setEpiChecked] = useState(true);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [cameraLoading, setCameraLoading] = useState<boolean>(false);
  const [successResult, setSuccessResult] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [isTorchOn, setIsTorchOn] = useState<boolean>(false);
  const [hasTorchCapability, setHasTorchCapability] = useState<boolean>(false);
  const [autoConfirm, setAutoConfirm] = useState<boolean>(true);
  const [retryCount, setRetryCount] = useState<number>(0);
  const [flashSuccess, setFlashSuccess] = useState<boolean>(false);
  const [lastScannedStudent, setLastScannedStudent] = useState<{ student: Student; time: string } | null>(null);
  const [recentScans, setRecentScans] = useState<Array<{ id: string; name: string; ra: string; time: string; photoUrl?: string }>>([]);

  // Scanned Student awaiting confirmation
  const [scannedStudent, setScannedStudent] = useState<Student | null>(null);
  const [scannedUnknownRa, setScannedUnknownRa] = useState<string | null>(null);
  const [scannedDynamicToken, setScannedDynamicToken] = useState<string | null>(null);

  // State for registering unknown student
  const [unknownRa, setUnknownRa] = useState('');
  const [unknownName, setUnknownName] = useState('');
  const [unknownClassId, setUnknownClassId] = useState<string>('');
  const [isRegistering, setIsRegistering] = useState<boolean>(false);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animationFrameId = useRef<number | null>(null);
  const lastScannedTime = useRef<number>(0);
  const lastScannedText = useRef<string>('');
  const lastConfirmedRaRef = useRef<string>('');
  const lastConfirmedTimeRef = useRef<number>(0);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const barcodeDetectorRef = useRef<any>(null);

  // Decoupled refs for real-time video scanner loop so camera NEVER reboots on state change
  const studentsRef = useRef(students);
  studentsRef.current = students;
  const activeSessionRef = useRef(activeSession);
  activeSessionRef.current = activeSession;
  const studentSelfCheckinRef = useRef(studentSelfCheckin);
  studentSelfCheckinRef.current = studentSelfCheckin;
  const setAttendanceStatusRef = useRef(setAttendanceStatus);
  setAttendanceStatusRef.current = setAttendanceStatus;
  const playBeepRef = useRef(playBeep);
  playBeepRef.current = playBeep;
  const autoConfirmRef = useRef(autoConfirm);
  autoConfirmRef.current = autoConfirm;
  const handleDecodedTextRef = useRef<((text: string) => void) | null>(null);
  const dynamicTokenRef = useRef(dynamicToken);
  dynamicTokenRef.current = dynamicToken;

  const selectedClass = classes.find(c => c.id === selectedClassId);

  // Initialize BarcodeDetector once if available in the browser
  useEffect(() => {
    if (typeof window !== 'undefined' && 'BarcodeDetector' in window && !barcodeDetectorRef.current) {
      try {
        barcodeDetectorRef.current = new (window as any).BarcodeDetector({
          formats: ['qr_code', 'code_128', 'code_39', 'ean_13', 'ean_8', 'data_matrix', 'itf', 'codabar', 'upc_a', 'upc_e']
        });
      } catch (e) {
        console.debug('BarcodeDetector init caught:', e);
      }
    }
  }, []);

  // When modal opens, reset state
  useEffect(() => {
    if (isOpen) {
      if (document.activeElement && typeof (document.activeElement as HTMLElement).blur === 'function') {
        (document.activeElement as HTMLElement).blur();
      }
      setScannedStudent(null);
      setScannedUnknownRa(null);
      setScannedDynamicToken(null);
      setSuccessResult(null);
      setErrorMessage(null);
      setCameraError(null);
    }
  }, [isOpen]);

  // Parse URL search parameters on opening if user came from a QR link
  useEffect(() => {
    if (!isOpen) return;
    const params = new URLSearchParams(window.location.search);
    const codeFromUrl = params.get('checkin') || params.get('t') || params.get('token');
    const raFromUrl = params.get('ra') || params.get('matricula');

    if (codeFromUrl) {
      setCodeInput(codeFromUrl);
    }
    if (raFromUrl) {
      setRaInput(raFromUrl);
      const matched = students.find(s => 
        s.registrationNumber.toUpperCase() === raFromUrl.trim().toUpperCase() ||
        s.registrationNumber.replace(/\D/g, '') === raFromUrl.trim().replace(/\D/g, '')
      );
      if (matched) {
        setScannedStudent(matched);
      }
    }
  }, [isOpen, students]);

  // Sync session code or dynamic token
  useEffect(() => {
    if (dynamicToken && !codeInput) {
      setCodeInput(dynamicToken);
    }
  }, [dynamicToken, codeInput]);

  // Clean and normalize RA string helper
  const extractAndNormalizeRa = (raw: string) => {
    if (!raw) return { ra: '', token: '', raw: '' };
    let text = raw.trim();
    let extractedToken = '';
    let extractedRa = '';

    // 1. URL Query Parsing
    if (text.includes('?') || text.startsWith('http://') || text.startsWith('https://')) {
      try {
        const urlObj = new URL(text.startsWith('http') ? text : `http://localhost/${text}`);
        const cParam = urlObj.searchParams.get('checkin') || urlObj.searchParams.get('t') || urlObj.searchParams.get('token');
        const rParam = urlObj.searchParams.get('ra') || urlObj.searchParams.get('matricula') || urlObj.searchParams.get('aluno');

        if (cParam) extractedToken = cParam;
        if (rParam) extractedRa = rParam;
      } catch {}
    } 
    // 2. JSON Payload
    else if (text.startsWith('{') && text.endsWith('}')) {
      try {
        const parsed = JSON.parse(text);
        if (parsed.ra || parsed.matricula || parsed.registrationNumber) {
          extractedRa = parsed.ra || parsed.matricula || parsed.registrationNumber;
        }
        if (parsed.token || parsed.code || parsed.checkin) {
          extractedToken = parsed.token || parsed.code || parsed.checkin;
        }
      } catch {}
    }

    let candidate = (extractedRa || text).trim();

    // 3. Strip common textual prefixes (e.g. "RA:", "RA ", "Matricula: ", "Aluno: ", "BMF4-")
    const cleaned = candidate
      .replace(/^(RA|R\.A\.|R\.A|Matr[ií]cula|Aluno|ID|Cart[aã]o|Docente|BMF4?)[\s:=-]+/i, '')
      .trim();

    return {
      ra: cleaned || candidate,
      token: extractedToken,
      raw: text,
    };
  };

  // Handle scanned decoded text from QR Code or Barcode
  const handleDecodedText = useCallback((text: string) => {
    if (!text || !text.trim()) return;
    const now = Date.now();
    const rawTrimmed = text.trim();

    // Debounce: Prevent duplicate trigger on the exact same raw string within 1.2s
    if (rawTrimmed === lastScannedText.current && now - lastScannedTime.current < 1200) {
      return;
    }

    const { ra: searchRa, token: extractedToken, raw } = extractAndNormalizeRa(text);

    // If this specific student was confirmed in the last 2.5s, ignore re-scan of the same card
    if (
      searchRa && 
      lastConfirmedRaRef.current && 
      (searchRa.toUpperCase() === lastConfirmedRaRef.current.toUpperCase() || searchRa.replace(/\D/g, '') === lastConfirmedRaRef.current.replace(/\D/g, '')) &&
      now - lastConfirmedTimeRef.current < 2500
    ) {
      return;
    }

    lastScannedText.current = rawTrimmed;
    lastScannedTime.current = now;

    const beep = playBeepRef.current;
    beep('scan');
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      try { navigator.vibrate([40, 20, 40]); } catch {}
    }

    // Check if it's a dynamic classroom token (from Telão / Dynamic QR)
    if (
      extractedToken.startsWith('BMF-') || 
      extractedToken.startsWith('TV-') || 
      extractedToken.startsWith('DYN-') ||
      extractedToken.startsWith('MED-') ||
      raw.startsWith('BMF-') || 
      raw.startsWith('TV-') || 
      raw.startsWith('DYN-')
    ) {
      const activeTok = extractedToken || raw;
      setCodeInput(activeTok);
      setScannedDynamicToken(activeTok);
      setSuccessResult(`Token Dinâmico da Aula Identificado: ${activeTok}`);
      setTimeout(() => setSuccessResult(null), 2500);
      return;
    }

    // Matching student search in current students list
    const currentStudents = studentsRef.current;
    const cleanAlpha = searchRa.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
    const cleanDigits = searchRa.replace(/\D/g, '');
    const searchUpper = searchRa.toUpperCase();

    const matchingStudent = currentStudents.find(s => {
      const sReg = s.registrationNumber.trim();
      const sAlpha = sReg.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
      const sDigits = sReg.replace(/\D/g, '');
      const sNameUpper = s.name.toUpperCase();

      // 1. Direct match (case-insensitive)
      if (sReg.toUpperCase() === searchUpper) return true;
      if (sAlpha && cleanAlpha && sAlpha === cleanAlpha) return true;

      // 2. Numeric digits match if RA has at least 4 digits
      if (sDigits.length >= 4 && cleanDigits.length >= 4) {
        if (sDigits === cleanDigits) return true;
        if (cleanDigits.length >= 6 && cleanDigits.includes(sDigits)) return true;
      }

      // 3. Substring match
      if (sReg.length >= 5 && raw.toUpperCase().includes(sReg.toUpperCase())) return true;
      if (sAlpha.length >= 5 && cleanAlpha.includes(sAlpha)) return true;

      // 4. Exact full name match
      if (searchUpper.length >= 6 && sNameUpper.includes(searchUpper)) return true;

      return false;
    });

    if (matchingStudent) {
      const timeStr = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      const currentActiveSession = activeSessionRef.current;
      const isAutoConfirm = autoConfirmRef.current;
      const doSelfCheckin = studentSelfCheckinRef.current;
      const tokenToUse = dynamicTokenRef.current || currentActiveSession?.checkinCode || 'AUTO';

      // If auto-confirm is active, use the exact same single-checkin engine as Dynamic QR
      if (isAutoConfirm) {
        lastConfirmedRaRef.current = matchingStudent.registrationNumber.toUpperCase();
        lastConfirmedTimeRef.current = Date.now();

        const result = doSelfCheckin(matchingStudent.registrationNumber, tokenToUse, false);

        if (result.needsOtherClassConfirmation) {
          playBeepRef.current('warning');
          setScannedStudent(matchingStudent);
          setScannedUnknownRa(null);
          setRaInput(matchingStudent.registrationNumber);
          setErrorMessage(`⚠️ Aluno(a) matriculado(a) na ${result.studentClassName || 'outra turma'}. Confirme manualmente abaixo para registrar como reposição na ${result.targetClassName || 'turma atual'}.`);
          return;
        }

        if (result.success) {
          playBeepRef.current('success');
          if (typeof navigator !== 'undefined' && navigator.vibrate) {
            try { navigator.vibrate([60, 30, 60]); } catch {}
          }

          setFlashSuccess(true);
          setTimeout(() => setFlashSuccess(false), 500);

          setLastScannedStudent({ student: matchingStudent, time: timeStr });
          setRecentScans(prev => [
            {
              id: matchingStudent.id,
              name: matchingStudent.name,
              ra: matchingStudent.registrationNumber,
              time: timeStr,
              photoUrl: matchingStudent.photoUrl
            },
            ...prev.filter(p => p.id !== matchingStudent.id).slice(0, 4)
          ]);

          const displayTurma = result.isOtherClass ? ` [Reposição da ${result.studentClassName}]` : '';
          setSuccessResult(`✅ Presença confirmada com sucesso: ${matchingStudent.name} (${matchingStudent.registrationNumber})${displayTurma}`);
          setScannedStudent(null);
          setScannedUnknownRa(null);
          setErrorMessage(null);

          setTimeout(() => {
            setSuccessResult(null);
          }, 2500);
        } else if (result.alreadyPresent) {
          playBeepRef.current('warning');
          if (typeof navigator !== 'undefined' && navigator.vibrate) {
            try { navigator.vibrate([100, 50, 100]); } catch {}
          }
          setSuccessResult(`❌ Presença já registrada anteriormente nesta aula! O aluno(a) ${matchingStudent.name} (RA: ${matchingStudent.registrationNumber}) já possui presença confirmada. Não é permitido marcar presença mais de uma vez.`);
          setScannedStudent(null);
          setScannedUnknownRa(null);
          setErrorMessage(null);

          setTimeout(() => {
            setSuccessResult(null);
          }, 3500);
        } else {
          playBeepRef.current('error');
          setErrorMessage(result.message || 'Erro ao registrar presença.');
        }
      } else {
        // Manual mode: professor reviews before confirming
        const currentPeriod = currentActiveSession?.activePeriod || 'both';
        const existingRec = currentActiveSession?.attendance?.[matchingStudent.id];
        let isAlreadyPresent = false;
        if (existingRec) {
          if (currentPeriod === 'p1_start') isAlreadyPresent = existingRec.p1StartStatus === 'present';
          else if (currentPeriod === 'p1_end') isAlreadyPresent = existingRec.p1EndStatus === 'present';
          else if (currentPeriod === 'p2_start') isAlreadyPresent = existingRec.p2StartStatus === 'present';
          else if (currentPeriod === 'p2_end') isAlreadyPresent = existingRec.p2EndStatus === 'present';
          else if (currentPeriod === '1') isAlreadyPresent = existingRec.period1Status === 'present' || existingRec.p1StartStatus === 'present' || existingRec.p1EndStatus === 'present';
          else if (currentPeriod === '2') isAlreadyPresent = existingRec.period2Status === 'present' || existingRec.p2StartStatus === 'present' || existingRec.p2EndStatus === 'present';
          else isAlreadyPresent = existingRec.status === 'present';
        }

        if (isAlreadyPresent) {
          playBeepRef.current('warning');
          setErrorMessage(`❌ Atenção: A presença de ${matchingStudent.name} (${matchingStudent.registrationNumber}) já foi registrada nesta aula.`);
        } else {
          setErrorMessage(null);
        }
        setScannedStudent(matchingStudent);
        setScannedUnknownRa(null);
        setRaInput(matchingStudent.registrationNumber);
      }
      return;
    }

    // If not found in student list, offer auto-registration with extracted RA
    const displayUnknown = searchRa.length > 0 ? searchRa : raw.substring(0, 20);
    setScannedUnknownRa(displayUnknown);
    setScannedStudent(null);
    setErrorMessage(`RA ${displayUnknown} lido, mas não consta na lista da turma.`);
  }, []);

  // Update ref to handleDecodedText
  useEffect(() => {
    handleDecodedTextRef.current = handleDecodedText;
  }, [handleDecodedText]);

  // Real-time video frame scanner loop (Hardware BarcodeDetector + jsQR fallback)
  const scanVideoFrame = useCallback(async () => {
    if (!videoRef.current || !canvasRef.current || videoRef.current.readyState < 2) {
      animationFrameId.current = requestAnimationFrame(scanVideoFrame);
      return;
    }

    const video = videoRef.current;
    const canvas = canvasRef.current;

    // 1. Hardware Accelerated BarcodeDetector API (Ultra-fast cached detector)
    if (barcodeDetectorRef.current) {
      try {
        const barcodes = await barcodeDetectorRef.current.detect(video);
        if (barcodes && barcodes.length > 0 && barcodes[0].rawValue) {
          if (handleDecodedTextRef.current) {
            handleDecodedTextRef.current(barcodes[0].rawValue.trim());
          }
          animationFrameId.current = requestAnimationFrame(scanVideoFrame);
          return;
        }
      } catch {
        // Fall back to jsQR
      }
    }

    // 2. jsQR Software Fallback
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) {
      animationFrameId.current = requestAnimationFrame(scanVideoFrame);
      return;
    }

    const width = video.videoWidth || 640;
    const height = video.videoHeight || 480;

    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }

    ctx.drawImage(video, 0, 0, width, height);

    try {
      const imageData = ctx.getImageData(0, 0, width, height);
      let code = jsQR(imageData.data, imageData.width, imageData.height, {
        inversionAttempts: 'attemptBoth',
      });

      if (!code && width > 200 && height > 200) {
        const boxSize = Math.min(width, height) * 0.8;
        const startX = (width - boxSize) / 2;
        const startY = (height - boxSize) / 2;
        const centerData = ctx.getImageData(startX, startY, boxSize, boxSize);
        code = jsQR(centerData.data, centerData.width, centerData.height, {
          inversionAttempts: 'attemptBoth',
        });
      }

      if (code && code.data && code.data.trim()) {
        if (handleDecodedTextRef.current) {
          handleDecodedTextRef.current(code.data.trim());
        }
      }
    } catch {
      // Ignored for performance
    }

    animationFrameId.current = requestAnimationFrame(scanVideoFrame);
  }, []);

  // Multi-tier Camera Stream Starter with Auto-Fallback - Decoupled so stream stays alive continuously
  useEffect(() => {
    let isMounted = true;

    async function startCamera() {
      if (!isOpen || mode !== 'camera') {
        if (streamRef.current) {
          streamRef.current.getTracks().forEach(track => track.stop());
          streamRef.current = null;
        }
        return;
      }

      setCameraLoading(true);
      setCameraError(null);

      // Stop previous stream if any
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
        streamRef.current = null;
      }

      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setCameraError('Seu navegador não possui suporte a leitor de câmera direta. Use o upload de imagem ou digite a Matrícula.');
        setCameraLoading(false);
        return;
      }

      let stream: MediaStream | null = null;

      // Strategy 1: Ideal resolution + facingMode
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: facingMode },
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
          audio: false,
        });
      } catch (e1) {
        console.debug('Strategy 1 camera failed, trying simple facingMode:', e1);
        // Strategy 2: Simple facingMode
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: { ideal: facingMode } },
            audio: false,
          });
        } catch (e2) {
          console.debug('Strategy 2 camera failed, trying generic video:', e2);
          // Strategy 3: Generic video
          try {
            stream = await navigator.mediaDevices.getUserMedia({
              video: true,
              audio: false,
            });
          } catch (e3: any) {
            console.warn('All camera strategies failed:', e3);
            if (isMounted) {
              setCameraLoading(false);
              const errMsg = e3?.name === 'NotAllowedError' || e3?.name === 'PermissionDeniedError'
                ? 'Permissão de câmera negada. Permita o acesso à câmera nas configurações do navegador ou use o envio de foto do QR code.'
                : e3?.name === 'NotFoundError' || e3?.name === 'DevicesNotFoundError'
                ? 'Nenhuma câmera encontrada neste dispositivo. Digite o RA manualmente ou envie uma imagem.'
                : 'Não foi possível inicializar a câmera. Tente novamente ou use a busca por Matrícula / RA.';
              setCameraError(errMsg);
            }
            return;
          }
        }
      }

      if (!isMounted) {
        if (stream) {
          stream.getTracks().forEach(track => track.stop());
        }
        return;
      }

      streamRef.current = stream;

      if (videoRef.current && stream) {
        videoRef.current.srcObject = stream;
        videoRef.current.setAttribute('playsinline', 'true');
        videoRef.current.setAttribute('muted', 'true');
        try {
          await videoRef.current.play();
        } catch (playErr) {
          console.debug('Video play caught:', playErr);
        }
      }

      const track = stream?.getVideoTracks()[0];
      const capabilities = (track && track.getCapabilities ? track.getCapabilities() : {}) as any;
      setHasTorchCapability(!!capabilities.torch);

      setCameraLoading(false);
      if (animationFrameId.current) {
        cancelAnimationFrame(animationFrameId.current);
      }
      animationFrameId.current = requestAnimationFrame(scanVideoFrame);
    }

    startCamera();

    return () => {
      isMounted = false;
      if (animationFrameId.current) {
        cancelAnimationFrame(animationFrameId.current);
        animationFrameId.current = null;
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
        streamRef.current = null;
      }
    };
  }, [isOpen, mode, facingMode, retryCount, scanVideoFrame]);

  // Image Upload File Scanner (works even if webcam permission is blocked in browser!)
  const handleImageFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        ctx.drawImage(img, 0, 0);
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const code = jsQR(imageData.data, imageData.width, imageData.height, {
          inversionAttempts: 'attemptBoth',
        });

        if (code && code.data) {
          handleDecodedText(code.data.trim());
          setSuccessResult('QR Code lido com sucesso na imagem!');
        } else {
          setErrorMessage('Nenhum QR Code legível foi detectado na imagem enviada.');
        }
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  // Toggle torch / lantern
  const toggleTorch = async () => {
    if (!streamRef.current) return;
    const videoTrack = streamRef.current.getVideoTracks()[0];
    if (!videoTrack) return;

    try {
      const newTorch = !isTorchOn;
      await (videoTrack as any).applyConstraints({
        advanced: [{ torch: newTorch }]
      });
      setIsTorchOn(newTorch);
    } catch {}
  };

  // Flip camera (front / back)
  const flipCamera = () => {
    setFacingMode(prev => prev === 'environment' ? 'user' : 'environment');
  };

  if (!isOpen) return null;

  // Confirm attendance for scanned student
  const handleConfirmScannedStudent = () => {
    if (!scannedStudent) return;
    
    const student = scannedStudent;
    const timeStr = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const checkinToken = dynamicToken || activeSession?.checkinCode || 'AUTO';
    
    // Explicitly confirm other class attendance when teacher clicks confirm
    const result = studentSelfCheckin(student.registrationNumber, checkinToken, true);

    lastConfirmedRaRef.current = student.registrationNumber.toUpperCase();
    lastConfirmedTimeRef.current = Date.now();

    if (result.success) {
      playBeep('success');
      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        try { navigator.vibrate([70, 35, 70]); } catch {}
      }
      
      setFlashSuccess(true);
      setTimeout(() => setFlashSuccess(false), 700);

      setLastScannedStudent({ student, time: timeStr });
      setRecentScans(prev => [
        {
          id: student.id,
          name: student.name,
          ra: student.registrationNumber,
          time: timeStr,
          photoUrl: student.photoUrl
        },
        ...prev.filter(p => p.id !== student.id).slice(0, 4)
      ]);
      const displayTurma = result.isOtherClass ? ` [Reposição da ${result.studentClassName}]` : '';
      setSuccessResult(`✅ Presença confirmada com sucesso: ${student.name} (${student.registrationNumber})${displayTurma}`);
      setErrorMessage(null);
    } else if (result.alreadyPresent) {
      playBeep('warning');
      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        try { navigator.vibrate([100, 50, 100]); } catch {}
      }
      setSuccessResult(`❌ Presença já registrada anteriormente nesta aula! O aluno(a) ${student.name} (RA: ${student.registrationNumber}) já possui presença confirmada. Não é permitido marcar presença mais de uma vez.`);
      setErrorMessage(null);
    } else {
      playBeep('error');
      setErrorMessage(result.message || 'Erro ao registrar presença.');
    }
    
    // Immediately clear scanned student state so camera is instantly ready for next reading
    setScannedStudent(null);
    setScannedUnknownRa(null);
    setRaInput('');
    
    setTimeout(() => {
      setSuccessResult(null);
    }, 3500);
  };

  // Process manual RA submit
  const handleSubmitManual = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setErrorMessage(null);
    setSuccessResult(null);

    const cleanRa = raInput.trim();
    if (!cleanRa) {
      setErrorMessage('Por favor, informe a matrícula / RA do aluno.');
      return;
    }

    const timeStr = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const checkinToken = codeInput || dynamicToken || activeSession?.checkinCode || 'AUTO';

    const result = studentSelfCheckin(cleanRa, checkinToken, false);

    if (result.needsOtherClassConfirmation && result.student) {
      playBeep('warning');
      setScannedStudent(result.student);
      setErrorMessage(`⚠️ Aluno(a) ${result.student.name} pertence à ${result.studentClassName || 'outra turma'}. Clique em "Confirmar Presença" para autorizar como reposição na ${result.targetClassName}.`);
      return;
    }

    if (result.success) {
      playBeep('success');
      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        try { navigator.vibrate([70, 35, 70]); } catch {}
      }
      const matched = result.student || students.find(s => 
        s.registrationNumber.toUpperCase() === cleanRa.toUpperCase() ||
        s.registrationNumber.replace(/\D/g, '') === cleanRa.replace(/\D/g, '')
      );
      if (matched) {
        setLastScannedStudent({ student: matched, time: timeStr });
        setRecentScans(prev => [
          {
            id: matched.id,
            name: matched.name,
            ra: matched.registrationNumber,
            time: timeStr,
            photoUrl: matched.photoUrl
          },
          ...prev.filter(p => p.id !== matched.id).slice(0, 4)
        ]);
      }
      const displayTurma = result.isOtherClass ? ` [Reposição da ${result.studentClassName}]` : '';
      setSuccessResult(`✅ Presença confirmada com sucesso para ${result.studentName || matched?.name || cleanRa}${displayTurma}`);
      setRaInput('');
      setScannedStudent(null);
      setTimeout(() => setSuccessResult(null), 3000);
    } else if (result.alreadyPresent) {
      playBeep('warning');
      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        try { navigator.vibrate([100, 50, 100]); } catch {}
      }
      setSuccessResult(`❌ Presença já registrada anteriormente nesta aula! O aluno(a) ${result.studentName || result.student?.name || cleanRa} já possui presença confirmada. Não é permitido marcar presença mais de uma vez.`);
      setRaInput('');
      setScannedStudent(null);
      setTimeout(() => setSuccessResult(null), 3500);
    } else {
      playBeep('error');
      setScannedUnknownRa(cleanRa);
      setUnknownRa(cleanRa);
      setErrorMessage(result.message || `Aluno com RA ${cleanRa} não localizado na lista da turma.`);
    }
  };

  // Save new unknown student immediately
  const handleSaveUnknownStudent = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (isRegistering) return;

    const trimmedName = unknownName.trim();
    const trimmedRa = (unknownRa || scannedUnknownRa || raInput || '').trim().toUpperCase();

    if (!trimmedName) {
      playBeep('alert');
      setErrorMessage('Por favor, informe o Nome Completo do aluno para confirmar.');
      return;
    }

    if (!trimmedRa) {
      playBeep('alert');
      setErrorMessage('Por favor, informe a Matrícula / RA do aluno.');
      return;
    }

    setIsRegistering(true);
    const safeguardTimer = setTimeout(() => {
      setIsRegistering(false);
    }, 6000);

    try {
      const reg = selfRegisterAndCheckin({
        name: trimmedName,
        registrationNumber: trimmedRa,
        classGroupId: unknownClassId || selectedClassId || classes[0]?.id || '',
      });

      clearTimeout(safeguardTimer);

      if (reg && reg.success) {
        playBeep('success');
        if (typeof navigator !== 'undefined' && navigator.vibrate) {
          try { navigator.vibrate([70, 35, 70]); } catch {}
        }

        const now = new Date();
        const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
        const registeredStudent = reg.student;

        if (registeredStudent) {
          setLastScannedStudent({ student: registeredStudent, time: timeStr });
          setRecentScans(prev => [
            {
              id: registeredStudent.id,
              name: registeredStudent.name,
              ra: registeredStudent.registrationNumber,
              time: timeStr,
              photoUrl: registeredStudent.photoUrl
            },
            ...prev.filter(p => p.id !== registeredStudent.id).slice(0, 4)
          ]);
        }

        setSuccessResult(reg.message || `✓ Aluno(a) ${trimmedName} cadastrado(a) e presença confirmada!`);
        setErrorMessage(null);
        setUnknownName('');
        setUnknownRa('');
        setScannedUnknownRa(null);
        setRaInput('');
        setMode('camera');
        setTimeout(() => setSuccessResult(null), 3500);
      } else {
        playBeep('error');
        setErrorMessage(reg?.message || 'Erro ao cadastrar aluno. Tente novamente.');
      }
    } catch (err: any) {
      clearTimeout(safeguardTimer);
      console.error('Registration error in QRScannerModal:', err);
      playBeep('error');
      setErrorMessage('Ocorreu um erro ao salvar o aluno. Tente novamente.');
    } finally {
      setIsRegistering(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/85 backdrop-blur-md animate-in fade-in duration-150">
      <div className="bg-white rounded-3xl w-full max-w-md overflow-hidden shadow-2xl border border-slate-200 flex flex-col max-h-[92vh]">
        
        {/* Header */}
        <div className="p-4 sm:p-5 bg-gradient-to-r from-slate-900 via-sky-950 to-teal-950 text-white flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-teal-500/20 border border-teal-500/40 flex items-center justify-center text-teal-300">
              <QrCode className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-white leading-tight flex items-center gap-2">
                <span>Leitor de QR Code BMF4</span>
                <span className="px-2 py-0.5 rounded-full bg-teal-500/20 text-teal-300 text-[10px] font-mono font-bold border border-teal-500/40">
                  AO VIVO
                </span>
              </h2>
              <p className="text-xs text-slate-300 truncate max-w-[260px] sm:max-w-xs">
                {selectedClass ? `Turma: ${selectedClass.name}` : 'Escanear QR Code de Presença'}
              </p>
            </div>
          </div>

          <button
            id="btn-close-scanner-modal"
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Dynamic Token Live Indicator */}
        <div className="px-4 py-2 bg-slate-100 border-b border-slate-200 flex items-center justify-between text-xs text-slate-600">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-teal-500 animate-ping" />
            <span className="font-semibold">Token Ativo na Sala:</span>
            <span className="font-mono font-bold text-slate-900 bg-white px-2 py-0.5 rounded-md border border-slate-200">
              {dynamicToken || activeSession?.checkinCode || 'BMF-MED'}
            </span>
          </div>

          {/* Auto Confirm Toggle */}
          <label className="flex items-center gap-1.5 cursor-pointer text-[11px] font-bold text-teal-800 bg-teal-50 px-2.5 py-1 rounded-xl border border-teal-200 hover:bg-teal-100 transition-colors">
            <input
              type="checkbox"
              checked={autoConfirm}
              onChange={(e) => setAutoConfirm(e.target.checked)}
              className="w-3.5 h-3.5 rounded text-teal-600 focus:ring-teal-500 cursor-pointer"
            />
            <Zap className="w-3 h-3 text-teal-600" />
            <span>Presença Direta</span>
          </label>
        </div>

        {/* Tabs: Câmera / Digitar RA / Novo Aluno */}
        <div className="flex border-b border-slate-200 bg-slate-50 p-1.5 gap-1 text-xs font-bold">
          <button
            type="button"
            id="btn-tab-scanner-camera"
            onClick={() => setMode('camera')}
            className={`flex-1 py-2 px-3 rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              mode === 'camera'
                ? 'bg-white text-sky-800 shadow-xs border border-slate-200/80 font-black'
                : 'text-slate-500 hover:text-slate-900'
            }`}
          >
            <Camera className="w-3.5 h-3.5" />
            <span>Câmera</span>
          </button>

          <button
            type="button"
            id="btn-tab-scanner-manual"
            onClick={() => setMode('manual')}
            className={`flex-1 py-2 px-3 rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              mode === 'manual'
                ? 'bg-white text-sky-800 shadow-xs border border-slate-200/80 font-black'
                : 'text-slate-500 hover:text-slate-900'
            }`}
          >
            <Search className="w-3.5 h-3.5" />
            <span>Digitar RA</span>
          </button>

          <button
            type="button"
            id="btn-tab-scanner-register"
            onClick={() => setMode('register')}
            className={`flex-1 py-2 px-3 rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              mode === 'register'
                ? 'bg-white text-emerald-800 shadow-xs border border-slate-200/80 font-black'
                : 'text-slate-500 hover:text-slate-900'
            }`}
          >
            <UserPlus className="w-3.5 h-3.5" />
            <span>Novo Aluno</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-4">
          
          {/* Alerts: Success & Error */}
          {successResult && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs sm:text-sm font-bold rounded-2xl flex items-center gap-2 animate-in fade-in">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
              <span>{successResult}</span>
            </div>
          )}

          {errorMessage && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold rounded-2xl flex items-start gap-2 animate-in fade-in">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <div className="flex-1">
                <span>{errorMessage}</span>
                {scannedUnknownRa && (
                  <div className="pt-2">
                    <button
                      type="button"
                      onClick={() => {
                        setUnknownRa(scannedUnknownRa);
                        setMode('register');
                      }}
                      className="px-3 py-1.5 bg-rose-700 text-white rounded-xl text-xs font-bold hover:bg-rose-800 cursor-pointer"
                    >
                      Cadastrar RA {scannedUnknownRa}
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 1: Real-time Camera Scanner */}
          {mode === 'camera' && (
            <div className="space-y-3">

              {/* In-Place Quick Auto-Registration Card when Student is Not Found */}
              {scannedUnknownRa && (
                <div className="p-4 rounded-2xl bg-gradient-to-br from-emerald-50 via-teal-50 to-emerald-50 border-2 border-emerald-500 shadow-lg space-y-3 animate-in zoom-in-95">
                  <div className="flex items-center justify-between">
                    <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-200 text-emerald-900 text-xs font-bold uppercase tracking-wider">
                      <Sparkles className="w-3.5 h-3.5 text-emerald-700" />
                      Aluno Não Encontrado • Cadastro Imediato
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setScannedUnknownRa(null);
                        setErrorMessage(null);
                      }}
                      className="text-slate-400 hover:text-slate-600 p-1 text-xs font-bold cursor-pointer"
                      title="Fechar"
                    >
                      ✕ Fechar
                    </button>
                  </div>

                  <p className="text-xs text-slate-800 leading-snug">
                    O RA <strong className="font-mono bg-white px-2 py-0.5 rounded border border-emerald-300 text-emerald-900">{scannedUnknownRa}</strong> não está cadastrado nesta turma. Preencha o nome para registrar e confirmar presença imediatamente:
                  </p>

                  <div>
                    <label className="text-[11px] font-bold text-slate-700 block mb-1">
                      Nome Completo do Aluno *
                    </label>
                    <input
                      type="text"
                      autoFocus
                      value={unknownName}
                      onChange={(e) => setUnknownName(e.target.value)}
                      placeholder="Ex: Beatriz Silva Medeiros"
                      className="w-full px-3.5 py-2.5 bg-white border border-emerald-400 rounded-xl text-xs sm:text-sm font-semibold text-slate-900 focus:ring-2 focus:ring-emerald-500 focus:outline-none shadow-xs"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          setUnknownRa(scannedUnknownRa);
                          handleSaveUnknownStudent(e as any);
                        }
                      }}
                    />
                  </div>

                  {classes.length > 1 && (
                    <div>
                      <label className="text-[11px] font-bold text-slate-700 block mb-1">
                        Turma / Disciplina
                      </label>
                      <select
                        value={unknownClassId || selectedClassId || classes[0]?.id || ''}
                        onChange={(e) => setUnknownClassId(e.target.value)}
                        className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-semibold text-slate-800 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                      >
                        {classes.map(c => (
                          <option key={c.id} value={c.id}>
                            {c.discipline} - {c.name} ({c.course})
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  <div className="flex items-center gap-2 pt-1">
                    <button
                      type="button"
                      id="btn-confirmar-cadastro-camera-rapido"
                      onClick={(e) => {
                        setUnknownRa(scannedUnknownRa);
                        handleSaveUnknownStudent(e as any);
                      }}
                      disabled={isRegistering}
                      className="flex-1 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-bold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-md cursor-pointer transition-all active:scale-98 disabled:opacity-75"
                    >
                      {isRegistering ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin text-white" />
                          <span>Cadastrando & Confirmando...</span>
                        </>
                      ) : (
                        <>
                          <CheckCircle2 className="w-4 h-4" />
                          <span>Cadastrar & Confirmar Presença</span>
                        </>
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setScannedUnknownRa(null);
                        setErrorMessage(null);
                      }}
                      className="px-3.5 py-3 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold text-xs cursor-pointer"
                    >
                      Descartar
                    </button>
                  </div>
                </div>
              )}
              
              {/* Scanned Student Card Pending Confirmation (Manual Mode) */}
              {scannedStudent && (
                <div className="p-4 rounded-2xl bg-teal-50 border-2 border-teal-500 shadow-md space-y-3 animate-in zoom-in-95">
                  <div className="flex items-center gap-3">
                    <StudentAvatar name={scannedStudent.name} photoUrl={scannedStudent.photoUrl} size="lg" />
                    <div className="flex-1 min-w-0">
                      <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-teal-200 text-teal-900 text-[10px] font-bold uppercase">
                        <Sparkles className="w-3 h-3 text-teal-700" />
                        Aluno Identificado
                      </div>
                      <h4 className="text-sm sm:text-base font-bold text-slate-900 truncate">
                        {scannedStudent.name}
                      </h4>
                      <p className="text-xs text-slate-600 font-mono font-bold">
                        RA: {scannedStudent.registrationNumber}
                      </p>
                    </div>
                  </div>

                  {/* EPI verification */}
                  <label className="flex items-center gap-2 p-2 rounded-xl bg-white/90 border border-teal-200 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={epiChecked}
                      onChange={(e) => setEpiChecked(e.target.checked)}
                      className="w-4 h-4 rounded text-teal-600 focus:ring-teal-500 cursor-pointer"
                    />
                    <span className="text-xs text-teal-900 font-bold flex items-center gap-1">
                      <ShieldCheck className="w-3.5 h-3.5 text-teal-600" />
                      EPIs Conferidos (Jaleco, Luvas, Calçados)
                    </span>
                  </label>

                  <div className="flex items-center gap-2 pt-1">
                    <button
                      type="button"
                      id="btn-confirm-scanned-student"
                      onClick={handleConfirmScannedStudent}
                      className="flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-bold text-xs sm:text-sm flex items-center justify-center gap-1.5 shadow-md active:scale-95 cursor-pointer transition-all"
                    >
                      <Check className="w-4 h-4" />
                      Confirmar e Ler Próximo
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setScannedStudent(null);
                        setErrorMessage(null);
                      }}
                      className="px-3 py-2.5 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold text-xs cursor-pointer"
                    >
                      Cancelar / Próximo
                    </button>
                  </div>
                </div>
              )}

              {/* CAMERA VIEWFINDER */}
              <div className="space-y-3 text-center">
                <div className={`relative w-full aspect-square max-w-[280px] mx-auto rounded-3xl overflow-hidden bg-slate-950 border-4 shadow-xl flex items-center justify-center transition-all duration-300 ${
                  flashSuccess 
                    ? 'border-emerald-400 ring-4 ring-emerald-400/50 shadow-emerald-500/20' 
                    : 'border-slate-800'
                }`}>
                    
                    {cameraLoading && (
                      <div className="absolute inset-0 z-20 bg-slate-950 flex flex-col items-center justify-center gap-2 text-slate-300">
                        <RefreshCw className="w-7 h-7 text-teal-400 animate-spin" />
                        <span className="text-xs font-bold">Iniciando câmera...</span>
                      </div>
                    )}

                    {/* Instant Success Flash Notification Overlay */}
                    {flashSuccess && lastScannedStudent && (
                      <div className="absolute inset-0 z-30 bg-emerald-950/75 backdrop-blur-xs flex flex-col items-center justify-center p-3 text-center animate-in zoom-in-95 duration-150">
                        <div className="w-12 h-12 rounded-full bg-emerald-500 text-white flex items-center justify-center mb-2 shadow-lg animate-bounce">
                          <Check className="w-7 h-7 stroke-[3]" />
                        </div>
                        <span className="px-2.5 py-0.5 rounded-full bg-emerald-400/20 text-emerald-300 text-[10px] font-bold tracking-wider uppercase border border-emerald-400/40">
                          Presença Registrada!
                        </span>
                        <h4 className="text-sm font-black text-white truncate max-w-[220px] mt-1">
                          {lastScannedStudent.student.name}
                        </h4>
                        <p className="text-xs font-mono font-bold text-emerald-200">
                          RA: {lastScannedStudent.student.registrationNumber}
                        </p>
                      </div>
                    )}

                    {/* Top Continuous Scan Beacon */}
                    <div className="absolute top-2.5 inset-x-2.5 z-20 flex items-center justify-between pointer-events-none">
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-900/90 border border-slate-700/80 text-[10px] font-bold text-teal-300 backdrop-blur-sm shadow-xs">
                        <span className="w-2 h-2 rounded-full bg-teal-400 animate-ping" />
                        <span>Leitura Contínua</span>
                      </span>

                      <span className="px-2 py-0.5 rounded-full bg-slate-900/90 text-slate-300 text-[10px] font-mono border border-slate-700/80">
                        Sem Pausas
                      </span>
                    </div>

                    {cameraError ? (
                      <div className="p-4 text-slate-300 text-xs space-y-3 z-20">
                        <AlertTriangle className="w-8 h-8 text-amber-400 mx-auto" />
                        <p className="text-[11px] leading-relaxed text-slate-300">{cameraError}</p>
                        
                        <div className="flex flex-col gap-2 pt-1">
                          <button
                            type="button"
                            onClick={() => {
                              setCameraError(null);
                              setRetryCount(c => c + 1);
                            }}
                            className="px-3.5 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 shadow-xs cursor-pointer"
                          >
                            <RotateCcw className="w-3.5 h-3.5" />
                            <span>Tentar Câmera Novamente</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => fileInputRef.current?.click()}
                            className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-teal-300 border border-slate-700 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer"
                          >
                            <Upload className="w-3.5 h-3.5" />
                            <span>Carregar Foto do QR Code</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => setMode('manual')}
                            className="px-3.5 py-1.5 text-slate-400 hover:text-white text-[11px] font-semibold underline cursor-pointer"
                          >
                            Ou Digitar Matrícula / RA
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <video
                          ref={videoRef}
                          autoPlay
                          playsInline
                          muted
                          className="w-full h-full object-cover"
                        />
                        
                        <canvas ref={canvasRef} className="hidden" />

                        {/* Optical scanning viewfinder */}
                        <div className={`absolute inset-5 border-2 rounded-2xl pointer-events-none flex flex-col justify-between p-2 transition-colors duration-200 ${
                          flashSuccess ? 'border-emerald-400' : 'border-teal-400/80'
                        }`}>
                          <div className="flex justify-between">
                            <span className={`w-5 h-5 border-t-4 border-l-4 rounded-tl-md ${flashSuccess ? 'border-emerald-400' : 'border-teal-400'}`} />
                            <span className={`w-5 h-5 border-t-4 border-r-4 rounded-tr-md ${flashSuccess ? 'border-emerald-400' : 'border-teal-400'}`} />
                          </div>
                          
                          {/* Active laser line */}
                          <div className={`w-full h-0.5 bg-gradient-to-r from-transparent to-transparent animate-pulse shadow-lg ${
                            flashSuccess 
                              ? 'via-emerald-300 shadow-emerald-400' 
                              : 'via-teal-400 shadow-teal-400'
                          }`} />
                          
                          <div className="flex justify-between">
                            <span className={`w-5 h-5 border-b-4 border-l-4 rounded-bl-md ${flashSuccess ? 'border-emerald-400' : 'border-teal-400'}`} />
                            <span className={`w-5 h-5 border-b-4 border-r-4 rounded-br-md ${flashSuccess ? 'border-emerald-400' : 'border-teal-400'}`} />
                          </div>
                        </div>

                        {/* Camera Controls Overlay */}
                        <div className="absolute bottom-2.5 inset-x-2.5 flex items-center justify-between px-2 z-10">
                          <button
                            type="button"
                            onClick={flipCamera}
                            className="p-1.5 rounded-xl bg-slate-900/90 hover:bg-slate-800 text-white border border-slate-700 backdrop-blur text-xs font-bold flex items-center gap-1 cursor-pointer shadow-md"
                            title="Girar Câmera (Frontal / Traseira)"
                          >
                            <RefreshCw className="w-3.5 h-3.5 text-teal-400" />
                            <span className="text-[10px]">Girar</span>
                          </button>

                          {/* Upload photo button inside viewfinder */}
                          <button
                            type="button"
                            onClick={() => fileInputRef.current?.click()}
                            className="p-1.5 rounded-xl bg-slate-900/90 hover:bg-slate-800 text-white border border-slate-700 backdrop-blur text-xs font-bold flex items-center gap-1 cursor-pointer shadow-md"
                            title="Enviar Foto / Print do QR Code"
                          >
                            <Upload className="w-3.5 h-3.5 text-teal-400" />
                            <span className="text-[10px]">Foto</span>
                          </button>

                          {hasTorchCapability && (
                            <button
                              type="button"
                              onClick={toggleTorch}
                              className={`p-1.5 rounded-xl border backdrop-blur text-xs font-bold flex items-center gap-1 cursor-pointer shadow-md ${
                                isTorchOn 
                                  ? 'bg-amber-500 text-slate-950 border-amber-300' 
                                  : 'bg-slate-900/90 text-white border-slate-700'
                              }`}
                              title="Ligar Lanterna / Flash"
                            >
                              <Flashlight className="w-3.5 h-3.5" />
                              <span className="text-[10px]">{isTorchOn ? 'Ligada' : 'Flash'}</span>
                            </button>
                          )}
                        </div>
                      </>
                    )}
                  </div>

                  {/* Hidden file input for upload scanning */}
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleImageFileUpload}
                    className="hidden"
                  />

                  <div className="space-y-1">
                    <p className="text-xs font-bold text-slate-800 flex items-center justify-center gap-1.5">
                      <Smartphone className="w-4 h-4 text-teal-600" />
                      Aponte a câmera para o QR Code do próximo aluno
                    </p>
                    <p className="text-[11px] text-slate-500">
                      O sistema registra a presença automaticamente com sinal sonoro e foca no próximo cartão.
                    </p>
                  </div>

                  {/* Recent Continuous Scans Strip */}
                  {recentScans.length > 0 && (
                    <div className="pt-2 border-t border-slate-100 text-left space-y-1.5">
                      <div className="flex items-center justify-between text-[11px] font-bold text-slate-600 px-1">
                        <span className="flex items-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                          Últimos Alunos Registrados ({recentScans.length}):
                        </span>
                        <span className="text-[10px] text-slate-400">Em tempo real</span>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {recentScans.map((scan) => (
                          <div 
                            key={scan.id} 
                            className="inline-flex items-center gap-1.5 px-2 py-1 rounded-xl bg-slate-50 border border-slate-200 text-[11px] text-slate-800 font-medium"
                          >
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                            <span className="font-semibold truncate max-w-[110px]">{scan.name.split(' ')[0]}</span>
                            <span className="font-mono text-[10px] text-slate-500">({scan.ra})</span>
                            <span className="text-[9px] text-slate-400">{scan.time}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
            </div>
          )}

          {/* TAB 2: Manual RA Input */}
          {mode === 'manual' && (
            <form onSubmit={handleSubmitManual} className="space-y-3.5">
              
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700">
                  Matrícula / RA do Aluno
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={raInput}
                    onChange={(e) => setRaInput(e.target.value)}
                    placeholder="Ex: 426202091 ou MED-202611"
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm font-semibold tracking-wide uppercase focus:bg-white focus:ring-2 focus:ring-teal-500 focus:outline-none"
                  />
                  <Search className="w-4 h-4 text-slate-400 absolute right-3 top-3 pointer-events-none" />
                </div>
              </div>

              {/* EPI Biosafety requirement */}
              <label className="flex items-center gap-2 p-2.5 rounded-xl bg-teal-50/70 border border-teal-200 cursor-pointer">
                <input
                  type="checkbox"
                  checked={epiChecked}
                  onChange={(e) => setEpiChecked(e.target.checked)}
                  className="w-4 h-4 rounded text-teal-600 focus:ring-teal-500 cursor-pointer"
                />
                <span className="text-xs text-teal-900 font-semibold flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-teal-600 shrink-0" />
                  EPIs verificados (Jaleco, Luvas, Sapatos)
                </span>
              </label>

              <button
                type="submit"
                className="w-full py-3 rounded-xl bg-teal-700 hover:bg-teal-800 text-white font-bold text-xs sm:text-sm shadow-md transition-all active:scale-98 flex items-center justify-center gap-2 cursor-pointer"
              >
                <UserCheck className="w-4 h-4" />
                Localizar & Registrar Presença
              </button>

              {/* In-Place Quick Auto-Registration Card when Student is Not Found in Manual Search */}
              {scannedUnknownRa && (
                <div className="p-4 rounded-2xl bg-gradient-to-br from-emerald-50 via-teal-50 to-emerald-50 border-2 border-emerald-500 shadow-lg space-y-3 animate-in zoom-in-95 mt-3">
                  <div className="flex items-center justify-between">
                    <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-200 text-emerald-900 text-xs font-bold uppercase tracking-wider">
                      <Sparkles className="w-3.5 h-3.5 text-emerald-700" />
                      Aluno Não Encontrado • Cadastro Imediato
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setScannedUnknownRa(null);
                        setErrorMessage(null);
                      }}
                      className="text-slate-400 hover:text-slate-600 p-1 text-xs font-bold cursor-pointer"
                      title="Fechar"
                    >
                      ✕ Fechar
                    </button>
                  </div>

                  <p className="text-xs text-slate-800 leading-snug">
                    O RA <strong className="font-mono bg-white px-2 py-0.5 rounded border border-emerald-300 text-emerald-900">{scannedUnknownRa}</strong> não consta nesta turma. Digite o nome para cadastrar e confirmar presença:
                  </p>

                  <div>
                    <label className="text-[11px] font-bold text-slate-700 block mb-1">
                      Nome Completo do Aluno *
                    </label>
                    <input
                      type="text"
                      autoFocus
                      value={unknownName}
                      onChange={(e) => setUnknownName(e.target.value)}
                      placeholder="Ex: Beatriz Silva Medeiros"
                      className="w-full px-3.5 py-2.5 bg-white border border-emerald-400 rounded-xl text-xs sm:text-sm font-semibold text-slate-900 focus:ring-2 focus:ring-emerald-500 focus:outline-none shadow-xs"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          setUnknownRa(scannedUnknownRa);
                          handleSaveUnknownStudent(e as any);
                        }
                      }}
                    />
                  </div>

                  {classes.length > 1 && (
                    <div>
                      <label className="text-[11px] font-bold text-slate-700 block mb-1">
                        Turma / Disciplina
                      </label>
                      <select
                        value={unknownClassId || selectedClassId || classes[0]?.id || ''}
                        onChange={(e) => setUnknownClassId(e.target.value)}
                        className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-semibold text-slate-800 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                      >
                        {classes.map(c => (
                          <option key={c.id} value={c.id}>
                            {c.discipline} - {c.name} ({c.course})
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  <div className="flex items-center gap-2 pt-1">
                    <button
                      type="button"
                      id="btn-confirmar-cadastro-manual-rapido"
                      onClick={(e) => {
                        setUnknownRa(scannedUnknownRa);
                        handleSaveUnknownStudent(e as any);
                      }}
                      disabled={isRegistering}
                      className="flex-1 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-bold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-md cursor-pointer transition-all active:scale-98 disabled:opacity-75"
                    >
                      {isRegistering ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin text-white" />
                          <span>Cadastrando & Confirmando...</span>
                        </>
                      ) : (
                        <>
                          <CheckCircle2 className="w-4 h-4" />
                          <span>Cadastrar & Confirmar Presença</span>
                        </>
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setScannedUnknownRa(null);
                        setErrorMessage(null);
                      }}
                      className="px-3.5 py-3 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold text-xs cursor-pointer"
                    >
                      Descartar
                    </button>
                  </div>
                </div>
              )}
            </form>
          )}

          {/* TAB 3: Auto-Registration */}
          {mode === 'register' && (
            <form onSubmit={handleSaveUnknownStudent} className="space-y-3.5">
              <div className="p-3.5 rounded-2xl bg-gradient-to-br from-emerald-50 to-teal-50 border border-emerald-200/80 text-emerald-900 text-xs font-medium space-y-1.5 shadow-xs">
                <div className="font-bold flex items-center gap-1.5 text-emerald-800 text-sm">
                  <Sparkles className="w-4 h-4 text-emerald-600 shrink-0" />
                  Cadastro & Presença Imediata
                </div>
                <p className="text-[11px] text-emerald-700 leading-relaxed">
                  O aluno será registrado no sistema e sua presença será confirmada automaticamente na aula atual em andamento.
                </p>
              </div>

              {/* Class selector */}
              {classes.length > 0 && (
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700">
                    Turma / Disciplina
                  </label>
                  <select
                    value={unknownClassId || selectedClassId || classes[0]?.id || ''}
                    onChange={(e) => setUnknownClassId(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs sm:text-sm font-semibold text-slate-800 focus:bg-white focus:ring-2 focus:ring-teal-500 focus:outline-none"
                  >
                    {classes.map(c => (
                      <option key={c.id} value={c.id}>
                        {c.discipline} - {c.name} ({c.course})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700 flex items-center justify-between">
                  <span>Nome Completo do Aluno *</span>
                  <span className="text-[10px] text-slate-400">Obrigatório</span>
                </label>
                <input
                  type="text"
                  required
                  autoFocus
                  value={unknownName}
                  onChange={(e) => setUnknownName(e.target.value)}
                  placeholder="Ex: Beatriz Silva Medeiros"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs sm:text-sm font-semibold focus:bg-white focus:ring-2 focus:ring-teal-500 focus:outline-none"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700 flex items-center justify-between">
                  <span>Matrícula / RA *</span>
                  <span className="text-[10px] text-slate-400">Obrigatório</span>
                </label>
                <input
                  type="text"
                  required
                  value={unknownRa}
                  onChange={(e) => setUnknownRa(e.target.value.toUpperCase())}
                  placeholder="Ex: 426202091"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs sm:text-sm font-semibold uppercase tracking-wider focus:bg-white focus:ring-2 focus:ring-teal-500 focus:outline-none font-mono"
                />
              </div>

              <button
                id="btn-confirmar-cadastro-novo-aluno"
                type="submit"
                disabled={isRegistering}
                className="w-full py-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-bold text-xs sm:text-sm shadow-md transition-all active:scale-98 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-75 disabled:cursor-wait"
              >
                {isRegistering ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin text-white" />
                    <span>Cadastrando & Confirmando Presença...</span>
                  </>
                ) : (
                  <>
                    <UserPlus className="w-4 h-4" />
                    <span>Cadastrar & Confirmar Presença</span>
                  </>
                )}
              </button>
            </form>
          )}

        </div>

      </div>
    </div>
  );
};
