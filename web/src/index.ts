import Whiteboard from "./lib/whiteboard";
declare global {
  interface Window { boardId?: string; }
}

const element = document.getElementsByClassName("canvas")[0];


if (element instanceof HTMLCanvasElement) {
  const whiteboard = new Whiteboard(element, window.boardId);
  whiteboard.run();
  // @ts-ignore
  window.whiteboard = whiteboard;
}
