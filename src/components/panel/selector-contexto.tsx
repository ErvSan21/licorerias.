export function SelectorTiendas({ children }: { children: React.ReactNode }) {
  return (
    <nav aria-label="Tienda" className="panel-chips">
      {children}
    </nav>
  );
}
