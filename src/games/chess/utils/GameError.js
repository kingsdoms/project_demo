// utils/game-error.js
export class GameError extends Error {
    constructor(code, message) {
        super(message)
        this.name = 'GameError'
        this.code = code
    }
}