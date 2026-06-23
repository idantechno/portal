import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

interface Point {
  x: number;
  y: number;
  t: number;
  width: number;
}
type Stroke = Point[];

interface SignaturePadProps {
  value: string | null;
  onChange: (dataUrl: string | null) => void;
  label?: string;
}

const MIN_WIDTH = 1.2;
const MAX_WIDTH = 3.2;
const VELOCITY_FILTER_WEIGHT = 0.7;

export function SignaturePad({
  value,
  onChange,
  label = "לחץ כאן לחתימה",
}: SignaturePadProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className={[
          "group relative flex h-36 w-full items-center justify-center rounded-2xl border-2 border-dashed",
          "transition-all touch-manipulation overflow-hidden",
          value
            ? "border-basil-500 bg-basil-100/40 hover:bg-basil-100/60"
            : "border-wheat bg-white/60 hover:border-peach-300 hover:bg-cream",
        ].join(" ")}
        aria-label={value ? "ערוך חתימה" : label}
      >
        {value ? (
          <>
            <img
              src={value}
              alt="חתימה"
              className="max-h-32 max-w-full object-contain mix-blend-multiply"
            />
            <span className="absolute bottom-1.5 left-2 rounded-full bg-cream/80 px-2 py-0.5 text-[11px] text-wood-700 opacity-0 transition-opacity group-hover:opacity-100">
              לחץ לעריכה
            </span>
            <span className="absolute right-2 top-2 rounded-full bg-basil-600/90 px-2 py-0.5 text-[11px] font-medium text-white">
              ✓ נחתם
            </span>
          </>
        ) : (
          <div className="flex flex-col items-center gap-2 text-wood-700/70">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.6}
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-8 w-8 text-tomato-500"
              aria-hidden="true"
            >
              <path d="M3 21c3-1 6-2 9-5s5-7 7-10" />
              <path d="M14 6l4 4" />
            </svg>
            <span className="font-display text-base text-wood-900">{label}</span>
            <span className="text-xs text-wood-700/60">
              תוכל לחתום באצבע במובייל או בעכבר במחשב
            </span>
          </div>
        )}
      </button>

      {isOpen && (
        <SignatureModal
          initialValue={value}
          onCancel={() => setIsOpen(false)}
          onConfirm={(dataUrl) => {
            onChange(dataUrl);
            setIsOpen(false);
          }}
        />
      )}
    </>
  );
}

function SignatureModal({
  initialValue,
  onCancel,
  onConfirm,
}: {
  initialValue: string | null;
  onCancel: () => void;
  onConfirm: (dataUrl: string) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const strokesRef = useRef<Stroke[]>([]);
  const currentStrokeRef = useRef<Stroke | null>(null);
  const lastVelocityRef = useRef(0);
  const lastWidthRef = useRef((MIN_WIDTH + MAX_WIDTH) / 2);
  const [hasSignature, setHasSignature] = useState(Boolean(initialValue));

  const redrawAll = useCallback((ctx: CanvasRenderingContext2D) => {
    for (const stroke of strokesRef.current) {
      drawStroke(ctx, stroke);
    }
  }, []);

  const resizeCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    const wrapper = wrapperRef.current;
    if (!canvas || !wrapper) return;
    const ratio = Math.max(window.devicePixelRatio || 1, 1);
    const rect = wrapper.getBoundingClientRect();
    canvas.width = Math.round(rect.width * ratio);
    canvas.height = Math.round(rect.height * ratio);
    canvas.style.width = `${rect.width}px`;
    canvas.style.height = `${rect.height}px`;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.scale(ratio, ratio);
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, rect.width, rect.height);
    redrawAll(ctx);
  }, [redrawAll]);

  useEffect(() => {
    resizeCanvas();
    const handler = () => resizeCanvas();
    window.addEventListener("resize", handler);
    window.addEventListener("orientationchange", handler);
    return () => {
      window.removeEventListener("resize", handler);
      window.removeEventListener("orientationchange", handler);
    };
  }, [resizeCanvas]);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  const getPoint = useCallback(
    (event: PointerEvent | React.PointerEvent): Point => {
      const canvas = canvasRef.current!;
      const rect = canvas.getBoundingClientRect();
      return {
        x: event.clientX - rect.left,
        y: event.clientY - rect.top,
        t: performance.now(),
        width: lastWidthRef.current,
      };
    },
    [],
  );

  const strokeWidthForVelocity = (velocity: number) => {
    const newWidth = Math.max(MAX_WIDTH - velocity * 0.15, MIN_WIDTH);
    const smoothed = newWidth * 0.6 + lastWidthRef.current * 0.4;
    lastWidthRef.current = smoothed;
    return smoothed;
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    (e.target as Element).setPointerCapture(e.pointerId);
    lastVelocityRef.current = 0;
    lastWidthRef.current = (MIN_WIDTH + MAX_WIDTH) / 2;
    const point = getPoint(e);
    currentStrokeRef.current = [point];

    const ctx = canvasRef.current?.getContext("2d");
    if (ctx) {
      ctx.fillStyle = "#2a190b";
      ctx.beginPath();
      ctx.arc(point.x, point.y, point.width / 2, 0, Math.PI * 2);
      ctx.fill();
    }
    if (!hasSignature) setHasSignature(true);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!currentStrokeRef.current) return;
    e.preventDefault();
    const point = getPoint(e);
    const stroke = currentStrokeRef.current;
    const last = stroke[stroke.length - 1];

    const dx = point.x - last.x;
    const dy = point.y - last.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < 0.5) return;

    const dt = Math.max(point.t - last.t, 1);
    const rawVelocity = dist / dt;
    const velocity =
      rawVelocity * VELOCITY_FILTER_WEIGHT +
      lastVelocityRef.current * (1 - VELOCITY_FILTER_WEIGHT);
    lastVelocityRef.current = velocity;
    point.width = strokeWidthForVelocity(velocity);

    stroke.push(point);

    const ctx = canvasRef.current?.getContext("2d");
    if (ctx && stroke.length >= 3) {
      drawLastSegment(ctx, stroke);
    } else if (ctx) {
      ctx.strokeStyle = "#2a190b";
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.lineWidth = point.width;
      ctx.beginPath();
      ctx.moveTo(last.x, last.y);
      ctx.lineTo(point.x, point.y);
      ctx.stroke();
    }
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!currentStrokeRef.current) return;
    try {
      (e.target as Element).releasePointerCapture(e.pointerId);
    } catch {
      // pointer was already released
    }
    if (currentStrokeRef.current.length > 0) {
      strokesRef.current.push(currentStrokeRef.current);
    }
    currentStrokeRef.current = null;
  };

  const handleClear = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const rect = canvas.getBoundingClientRect();
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, rect.width, rect.height);
    strokesRef.current = [];
    currentStrokeRef.current = null;
    setHasSignature(false);
  };

  const handleConfirm = () => {
    const canvas = canvasRef.current;
    if (!canvas || !hasSignature) return;
    const dataUrl = canvas.toDataURL("image/png");
    onConfirm(dataUrl);
  };

  if (typeof document === "undefined") return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-wood-900/60 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="חתימה דיגיטלית"
    >
      <div className="w-full max-w-2xl overflow-hidden rounded-3xl bg-cream shadow-2xl ring-1 ring-wheat animate-fade-up">
        <div className="flex items-center justify-between border-b border-wheat bg-gradient-to-l from-peach-100/60 to-cream px-5 py-3.5">
          <div className="flex items-center gap-2">
            <span aria-hidden className="block h-2 w-2 rounded-full bg-tomato-500" />
            <h2 className="font-display text-lg text-wood-900">חתימה דיגיטלית</h2>
          </div>
          <button
            type="button"
            onClick={onCancel}
            className="rounded-full p-1.5 text-wood-700/60 hover:bg-wheat/30 hover:text-wood-900"
            aria-label="סגור"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-5 w-5"
              aria-hidden="true"
            >
              <path d="M18 6L6 18" />
              <path d="M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-5">
          <p className="mb-3 text-sm text-wood-700/80">
            חתום בתוך המסגרת באצבע או בעכבר. החתימה תצורף ל־PDF החתום.
          </p>

          <div
            ref={wrapperRef}
            className="relative aspect-[5/3] w-full overflow-hidden rounded-2xl border-2 border-dashed border-wheat bg-white"
          >
            <canvas
              ref={canvasRef}
              className="signature-canvas absolute inset-0 h-full w-full"
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerCancel={handlePointerUp}
              onPointerLeave={handlePointerUp}
            />
            <div className="pointer-events-none absolute inset-x-8 bottom-10 border-t border-dashed border-wheat" />
            {!hasSignature && (
              <div className="pointer-events-none absolute inset-x-0 bottom-3 text-center font-display text-sm text-wood-700/40">
                ✎ חתום כאן
              </div>
            )}
          </div>
        </div>

        <div className="flex flex-col-reverse gap-2 border-t border-wheat bg-peach-50/50 p-4 sm:flex-row sm:justify-between">
          <button
            type="button"
            onClick={handleClear}
            className="rounded-xl border border-wheat bg-white px-4 py-2.5 text-sm font-medium text-wood-900 hover:bg-cream active:bg-peach-50"
          >
            ניקוי
          </button>
          <div className="flex flex-col gap-2 sm:flex-row">
            <button
              type="button"
              onClick={onCancel}
              className="rounded-xl border border-wheat bg-white px-4 py-2.5 text-sm font-medium text-wood-700 hover:bg-cream"
            >
              ביטול
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              disabled={!hasSignature}
              className="rounded-xl bg-basil-600 px-6 py-2.5 text-sm font-semibold text-white shadow-md transition hover:bg-basil-700 active:bg-basil-700 disabled:cursor-not-allowed disabled:bg-wood-300 disabled:shadow-none"
            >
              אישור חתימה ✓
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}

function drawStroke(ctx: CanvasRenderingContext2D, stroke: Stroke) {
  if (stroke.length === 0) return;
  ctx.fillStyle = "#2a190b";
  ctx.strokeStyle = "#2a190b";
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  if (stroke.length === 1) {
    const p = stroke[0];
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.width / 2, 0, Math.PI * 2);
    ctx.fill();
    return;
  }
  for (let i = 1; i < stroke.length; i++) {
    drawSegmentBetween(ctx, stroke, i);
  }
}

function drawLastSegment(ctx: CanvasRenderingContext2D, stroke: Stroke) {
  const i = stroke.length - 1;
  drawSegmentBetween(ctx, stroke, i);
}

function drawSegmentBetween(
  ctx: CanvasRenderingContext2D,
  stroke: Stroke,
  i: number,
) {
  const prev = stroke[i - 1];
  const curr = stroke[i];
  const prevPrev = i >= 2 ? stroke[i - 2] : prev;
  const next = i + 1 < stroke.length ? stroke[i + 1] : curr;

  const m1 = midpoint(prevPrev, prev);
  const m2 = midpoint(prev, curr);
  const m3 = midpoint(curr, next);

  ctx.lineWidth = curr.width;
  ctx.strokeStyle = "#2a190b";
  ctx.beginPath();
  ctx.moveTo(m1.x, m1.y);
  ctx.quadraticCurveTo(prev.x, prev.y, m2.x, m2.y);
  ctx.quadraticCurveTo(curr.x, curr.y, m3.x, m3.y);
  ctx.stroke();
}

function midpoint(a: { x: number; y: number }, b: { x: number; y: number }) {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}
