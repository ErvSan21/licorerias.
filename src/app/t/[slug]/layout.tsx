export default function PanelLayout({ children }: { children: React.ReactNode }) {
  return <div className="flex min-h-full flex-1 flex-col">{children}</div>;
}