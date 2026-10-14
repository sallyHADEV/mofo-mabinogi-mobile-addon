import React, { useLayoutEffect, useRef, useState } from 'react';

export const DockMarquee = React.memo(function DockMarquee({ text }: { text: string }) {
  const viewport = useRef<HTMLDivElement>(null);
  const content = useRef<HTMLSpanElement>(null);
  const [distance, setDistance] = useState(0);
  useLayoutEffect(() => {
    const measure = () => setDistance(Math.max(0, (content.current?.scrollWidth ?? 0) - (viewport.current?.clientWidth ?? 0)));
    const observer = new ResizeObserver(measure);
    if (viewport.current) observer.observe(viewport.current);
    if (content.current) observer.observe(content.current);
    measure();
    return () => observer.disconnect();
  }, [text]);
  return <div ref={viewport} className="dock-marquee" title={text}>
    <span ref={content} style={{
      '--marquee-distance': `${-distance}px`,
      animation: distance > 0 ? `dock-scroll ${Math.max(6, distance / 22 + 3)}s ease-in-out infinite alternate` : 'none',
    } as React.CSSProperties}>{text}</span>
  </div>;
});

