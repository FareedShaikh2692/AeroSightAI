"use client";
export function PrintButton() {
  return <button type="button" className="btn btn-secondary" onClick={() => window.print()}>Download PDF</button>;
}
