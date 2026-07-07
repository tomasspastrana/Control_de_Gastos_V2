import type { ReactNode } from "react";

function Blobs() {
  return (
    <>
      <div style={{ position: "fixed", top: -160, left: -120, width: 520, height: 520, borderRadius: "50%", background: "radial-gradient(circle,rgba(140,120,250,.45),transparent 70%)", filter: "blur(30px)", animation: "tj-float1 22s ease-in-out infinite", willChange: "transform", pointerEvents: "none", zIndex: 0 }} />
      <div style={{ position: "fixed", bottom: -200, right: -140, width: 560, height: 560, borderRadius: "50%", background: "radial-gradient(circle,rgba(180,150,255,.40),transparent 70%)", filter: "blur(30px)", animation: "tj-float2 26s ease-in-out infinite", willChange: "transform", pointerEvents: "none", zIndex: 0 }} />
    </>
  );
}

interface Props {
  sidebar: ReactNode;
  children: ReactNode;
  showBlobs?: boolean;
}

export function AppShell({ sidebar, children, showBlobs = true }: Props) {
  return (
    <div style={{ minHeight: "100vh", position: "relative", background: "var(--tj-bg)" }}>
      {showBlobs && <Blobs />}
      <div className="tj-shell">
        {sidebar}
        <main className="tj-main">{children}</main>
      </div>
    </div>
  );
}
