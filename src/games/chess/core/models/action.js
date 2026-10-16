//ý định đầu vào, chưa kiểm tra
export class Action {
  static move(id, row, col) {
    return new Action(ActionType.MOVE, { id, row, col });
  }

  static promote(id, pieceType) {
    return new Action(ActionType.PROMOTE, { id, pieceType });
  }

  constructor(type, data) {
    this.type = type;
    Object.assign(this, data);
  }
}
