import ReconnectingWebSocket from "reconnecting-websocket";

const SENDING_COLOR = "#7d2222";
const DRAWING_COLOR = "#ea3ab4a1";

// ws messages 
type WSMessage = {
  type: "INIT",
  data: {
    paths: Path[];
    version: number;
  }
} | {
  type: "ACK",
  data: {
    version: number;
  }
} | {
  type: "REMOTE_CHANGE",
  data: {
    path: Path,
    version: number,
  }
}

type WSSendingMessage = {
  type: "ADD_PATH",
  data: Path;
} | {
  type: "REQ_INIT"
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
  version = 0;
  sendingQueue: Path[] = [];
  sendingPath: Path | null = null;
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
    this.drawingPath = { points: [[x, y]], color: DRAWING_COLOR };
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
    this.sendingQueue.push(this.drawingPath);
    this.drawingPath = null;
    this.sendPaths();
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
      case "ACK":
        if (!this.sendingPath) {
          // should never happen
          return
        }
        if (this.version + 1 !== data.data.version) {
          // lost some messages; client out of sync;
          // resart as a last resort to keep in sync;
          this.restart()
          return;
        }
        this.paths.push(this.sendingPath);
        this.sendingPath = null;
        this.version = data.data.version;
        if (this.sendingQueue.length) {
          this.sendPaths();
        }
        this.render();
        return;
      case "REMOTE_CHANGE":
        if (this.version + 1 !== data.data.version) {
          // client has more data than server?
          this.restart()
          return
        }
        this.paths.push(data.data.path);
        this.version = data.data.version;
        // TODO: dedup code
        if (this.sendingQueue.length) {
          this.sendPaths();
        }
        this.render();
        return;
      case "INIT":
        this.loading = false;
        this.paths = data.data.paths;
        this.version = data.data.version;
        this.render();
        return  
      default:
        return
    }
  }
  sendPaths = () => {
    // always wait for ack before sending another
    if (this.sendingPath) return;
    if (!this.sendingQueue.length) return;
    this.sendingPath = this.sendingQueue[0];
    this.sendingQueue = this.sendingQueue.slice(1);
    const addPathMessage = {
      type: "ADD_PATH",
      data: this.sendingPath,
    } as const;
    this.sendJSON(addPathMessage);
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
  restart = () => {
    this.sendJSON({type: "REQ_INIT"});
  }
  render = () => {
    // clear
    this.ctx.clearRect(0, 0, this.element.width, this.element.height);
    if (this.loading) {
      this.ctx.font = "24px serif";
      this.ctx.fillText("Loading", 100, 100)
    }
    // render acked paths
    this.paths.forEach(path => {
      this.renderPath(path);
    });
    // render sending paths
    if (this.sendingPath) {
      this.renderPath(this.sendingPath, SENDING_COLOR);
    }
    this.sendingQueue.forEach(path => {
      this.renderPath(path, SENDING_COLOR);
    })
    // render drawing path
    if (this.drawingPath) {
      this.renderPath(this.drawingPath);
    }
  };
  renderPath = (path: Path, overrideColor?: string) => {
    this.ctx.beginPath();
    path.points.forEach(point => {
      const [x, y] = point;
      this.ctx.lineTo(x, y);
    });
    this.ctx.strokeStyle = path.color;
    if (overrideColor) {
      this.ctx.strokeStyle = overrideColor;
    }
    this.ctx.stroke();
  };
  sendJSON = (message: WSSendingMessage) => {
    this.socket.send(JSON.stringify(message));
  }
}

export default Whiteboard;
