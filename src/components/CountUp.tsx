import { useEffect, useState } from "react";

interface CountUpProps {
  end: number;
  duration?: number;
  suffix?: string;
  decimals?: number;
}

const CountUp = ({ end, duration = 1200, suffix = "", decimals = 0 }: CountUpProps) => {
  const [value, setValue] = useState(0);

  useEffect(() => {
    const start = 0;
    const startTime = performance.now();
    const animate = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(start + (end - start) * eased);
      if (progress < 1) requestAnimationFrame(animate);
    };
    requestAnimationFrame(animate);
  }, [end, duration]);

  return <>{decimals > 0 ? value.toFixed(decimals) : Math.round(value)}{suffix}</>;
};

export default CountUp;
