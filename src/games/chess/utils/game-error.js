// utils/game-error.js
import { ErrorCode } from '../constants/error-code.js'

export class GameError extends Error {
    constructor(code, message) {
        super(message)
        this.name = 'GameError'
        this.code = code
    }
}