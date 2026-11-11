/** Fixed, read-only code: the RPC never accepts arbitrary JavaScript from clients. */
export const SELECTION_CODE = `
const selected = [...penpot.selection];
if (!penpot.currentFile || !penpot.currentPage) throw new Error("No active Penpot file");
if (selected.length > 50) throw new Error("Select at most 50 layers");
return {
  file: { id: penpot.currentFile.id, name: penpot.currentFile.name },
  page: { id: penpot.currentPage.id, name: penpot.currentPage.name },
  layers: selected.map(shape => ({ id: shape.id, name: shape.name, type: shape.type }))
};
`;
