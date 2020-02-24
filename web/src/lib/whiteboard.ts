import ReconnectingWebSocket from "reconnecting-websocket";

// ws messages 
type WSMessage = {
  type: "INIT",
  data: {
    paths: Path[];
  }
}

type WSSendingMessage = {
  type: "ADD_PATH",
  data: Path;
}

type Path = {
  points: [number, number][];
  color: string;
};
class Whiteboard {
  element: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  paths: Path[];
  drawingPath: Path | null;
  socket: ReconnectingWebSocket | null;
  boardId: string;
  loading = true;
  constructor(element: HTMLCanvasElement, boardId: string) {
    this.element = element;
    this.ctx = this.element.getContext("2d");
    this.paths = [
      {
        points: [],
        color: "black"
      }
    ];
    this.drawingPath = null;

    this.socket = null;
    this.boardId = boardId;
  }
  onMouseDown = (e: MouseEvent) => {
    if (this.drawingPath) {
      // this should not happen
      return;
    }
    const { clientX, clientY } = e;
    const rect = this.element.getBoundingClientRect();
    const x = clientX - rect.x;
    const y = clientY - rect.y;
    this.drawingPath = { points: [[x, y]], color: "#ea3ab4a1" };
    this.render();
  };
  onMouseUp = (e: MouseEvent) => {
    if (!this.drawingPath) {
      // this should not happen
      return;
    }
    const { clientX, clientY } = e;
    const rect = this.element.getBoundingClientRect();
    const x = clientX - rect.x;
    const y = clientY - rect.y;
    this.drawingPath.points.push([x, y]);
    this.drawingPath.color = "black";
    // just send the path for now
    const addPathMessage: WSSendingMessage = {
      type: "ADD_PATH",
      data: this.drawingPath
    }
    this.socket.send(JSON.stringify(addPathMessage));
    this.paths.push(this.drawingPath);
    this.drawingPath = null;
    this.render();
  };
  onMouseMove = (e: MouseEvent) => {
    if (!this.drawingPath) {
      // this should not happen
      return;
    }
    const { clientX, clientY } = e;
    const rect = this.element.getBoundingClientRect();
    const x = clientX - rect.x;
    const y = clientY - rect.y;
    this.drawingPath.points.push([x, y]);
    this.render();
  };
  onMouseOut = this.onMouseUp;
  onWSMessage = (message: MessageEvent) => {
    const data = JSON.parse(message.data) as WSMessage;
    switch (data.type) {
      case "INIT":
        this.loading = false;
        this.paths = data.data.paths;
        this.render();
        return  
      default:
        return
    }
  }
  run = () => {
    this.element.height = 500;
    this.element.width = 500;
    this.render();
    // events
    this.element.addEventListener("mousedown", this.onMouseDown);
    this.element.addEventListener("mouseup", this.onMouseUp);
    this.element.addEventListener("mousemove", this.onMouseMove);
    this.element.addEventListener("mouseout", this.onMouseOut);

    // socket
    const wsProtocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    this.socket = new ReconnectingWebSocket(
      `${wsProtocol}//${location.host}/board/${this.boardId}/`
    );
    this.socket.addEventListener("message", this.onWSMessage)
  };
  render = () => {
    // clear
    this.ctx.clearRect(0, 0, this.element.width, this.element.height);
    if (this.loading) {
      this.ctx.font = "24px serif";
      this.ctx.fillText("Loading", 100, 100)
    }
    this.paths.forEach(path => {
      this.renderPath(path);
    });
    if (this.drawingPath) {
      this.renderPath(this.drawingPath);
    }
  };
  renderPath = (path: Path) => {
    this.ctx.beginPath();
    path.points.forEach(point => {
      const [x, y] = point;
      this.ctx.lineTo(x, y);
    });
    this.ctx.strokeStyle = path.color;
    this.ctx.stroke();
  };
}

export default Whiteboard;
