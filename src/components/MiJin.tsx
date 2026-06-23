/**
 * 미진님 캐릭터 컴포넌트
 * variant: 'nod' | 'wave' | 'bounce' | 'still'
 * size: px 단위 (기본 48)
 */

interface Props {
  variant?: "nod" | "wave" | "bounce" | "still";
  size?: number;
  className?: string;
}

const keyframes = `
@keyframes mijin-nod {
  0%, 100% { transform: rotate(0deg); }
  25% { transform: rotate(-8deg); }
  75% { transform: rotate(8deg); }
}
@keyframes mijin-wave {
  0%, 100% { transform: rotate(0deg) translateY(0px); }
  20% { transform: rotate(-10deg) translateY(-2px); }
  40% { transform: rotate(10deg) translateY(-4px); }
  60% { transform: rotate(-8deg) translateY(-2px); }
  80% { transform: rotate(6deg) translateY(0px); }
}
@keyframes mijin-bounce {
  0%, 100% { transform: translateY(0px) scale(1); }
  40% { transform: translateY(-6px) scale(1.05); }
  60% { transform: translateY(-4px) scale(1.03); }
}
`;

const animationMap: Record<string, string> = {
  nod: "mijin-nod 1.2s ease-in-out infinite",
  wave: "mijin-wave 1.0s ease-in-out infinite",
  bounce: "mijin-bounce 1.4s ease-in-out infinite",
  still: "none",
};

export default function MiJin({
  variant = "still",
  size = 48,
  className = "",
}: Props) {
  const anim = animationMap[variant];

  return (
    <>
      <style>{keyframes}</style>
      <div
        className={`inline-block shrink-0 ${className}`}
        style={{
          width: size,
          height: size,
          borderRadius: "50%",
          overflow: "hidden",
          animation: anim,
          transformOrigin: "bottom center",
        }}
      >
        <img
          src="/mijin.png"
          alt="미진님 캐릭터"
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
            objectPosition: "top center",
          }}
        />
      </div>
    </>
  );
}
