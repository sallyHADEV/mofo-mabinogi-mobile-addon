import { useState, useCallback, useRef, useEffect } from 'react';
import type { WidgetPosition } from '../types.js';

interface UseDraggableOptions {
  position: WidgetPosition;
  onPositionChange: (pos: WidgetPosition) => void;
  disabled?: boolean;
}

export function useDraggable({ position, onPositionChange, disabled = false }: UseDraggableOptions) {
  const [isDragging, setIsDragging] = useState(false);
  const startRef = useRef<{
    mouseX: number;
    mouseY: number;
    startX: number;
    startY: number;
    maxX: number;
    maxY: number;
  } | null>(null);
  const cleanupRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    return () => {
      if (cleanupRef.current) {
        cleanupRef.current();
      }
    };
  }, []);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (disabled) return;
      // 좌클릭만 반응
      if (e.button !== 0) return;

      // 버튼, 입력창, 링크 등 인터랙티브 요소는 드래그 대상에서 제외
      const target = e.target as HTMLElement;
      if (target.closest('button, input, textarea, select, a')) return;

      e.preventDefault();
      e.stopPropagation();

      if (cleanupRef.current) {
        cleanupRef.current();
      }

      const el = e.currentTarget as HTMLElement | null;
      const rect = el ? el.getBoundingClientRect() : null;

      // 엘리먼트 크기 측정 또는 기본 안전 마진(60, 40) 동적 계산
      const elWidth = rect && rect.width > 0 ? rect.width : 60;
      const elHeight = rect && rect.height > 0 ? rect.height : 40;

      // 엘리먼트 전체가 화면 경계 내에 자연스럽게 머무를 수 있도록 동적 한계치 산출
      const maxX = Math.max(0, window.innerWidth - elWidth);
      const maxY = Math.max(0, window.innerHeight - elHeight);

      startRef.current = {
        mouseX: e.clientX,
        mouseY: e.clientY,
        startX: position.x,
        startY: position.y,
        maxX,
        maxY,
      };
      setIsDragging(true);

      const handleMouseMove = (moveEvent: MouseEvent) => {
        if (!startRef.current) return;
        const dx = moveEvent.clientX - startRef.current.mouseX;
        const dy = moveEvent.clientY - startRef.current.mouseY;

        // 마우스 커서와 1:1 완벽 고정 (가속/더블 오프셋 없음) 및 동적 클램핑 한계치 적용
        const newX = Math.max(0, Math.min(startRef.current.maxX, startRef.current.startX + dx));
        const newY = Math.max(0, Math.min(startRef.current.maxY, startRef.current.startY + dy));

        onPositionChange({ x: newX, y: newY });
      };

      const handleMouseUp = () => {
        cleanup();
      };

      const cleanup = () => {
        startRef.current = null;
        setIsDragging(false);
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
        window.removeEventListener('blur', handleMouseUp);
        cleanupRef.current = null;
      };

      cleanupRef.current = cleanup;

      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      window.addEventListener('blur', handleMouseUp);
    },
    [disabled, position, onPositionChange]
  );

  return { handleMouseDown, isDragging };
}
