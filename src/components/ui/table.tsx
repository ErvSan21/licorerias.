export function Table({ etiqueta, children }: { etiqueta: string; children: React.ReactNode }) {
  return (
    <div className="ui-tabla-marco">
      <table className="ui-tabla">
        <caption className="sr-only">{etiqueta}</caption>
        {children}
      </table>
    </div>
  );
}
