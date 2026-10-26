/**
 * @file index.js
 * @author tuanca
 */
// API chính
// Cửa duy nhất của plugin cờ vua: App chỉ import file này.
// core/, bot/, ui/ không import ngược lại file này.
// Mỗi lần gọi tạo một room mới, độc lập với các room khác.
// Nút "bắt đầu" gọi hàm này, nút "ván mới" gọi room.restart().
import { Room } from "./core/engine/room.js";
import { Side, randomSide, OPPONENT } from "./core/constants/Side.js";
import { createController } from "./controller/createController.js";

export const GameMode = Object.freeze({
  VS_BOT: "VS_BOT", // human x bot
  BOT: "BOT", // bot x bot
  LOCAL: "LOCAL", // human x human
  ONLINE: "ONLINE", // human x human
});

/**
 * DEV NOTE
 * Luôn để quân Trắng đi trước, còn random bên sẽ quyết định người chơi nào được cầm quân Trắng
 * VS_BOT: random bên của người chơi; nếu người chơi là WHITE thì bot cầm BLACK, và ngược lại.
 * LOCAL: hai người chơi cùng máy, mặc định một người cầm Trắng và người còn lại cầm Đen
 * ONLINE: server random bên sau khi ghép được hai người, rồi gán bên còn lại cho đối thủ.
 *
 */

export default {
  id: "chess",
  title: "Cờ vua",
  /**
   * Nút "Bắt đầu" gọi hàm này. Trả controller, App không thấy room hay bot.
   * Nút "Ván mới" gọi controller.actions.restart().
   *
   * @param {object} [options]
   * @param {(typeof GameMode)[keyof typeof GameMode]} [options.mode=GameMode.VS_BOT]
   * @param {number} [options.botDelay=400]
   */
  create(options = {}) {
    const { mode = GameMode.VS_BOT, botDelay = 400 } = options;

    /** @type {typeof Side[keyof typeof Side][]} */ let humanSides = [];
    /** @type {typeof Side[keyof typeof Side][]} */ let botSides = [];

    switch (mode) {
      case GameMode.VS_BOT: {
        const humanSide = randomSide();

        humanSides = [humanSide];
        botSides = [OPPONENT[humanSide]];
        break;
      }

      case GameMode.BOT: {
        botSides = Object.values(Side);
        break;
      }

      case GameMode.LOCAL: {
        humanSides = Object.values(Side);
        break;
      }

      case GameMode.ONLINE: {
        throw new Error("ONLINE mode requires a matched room from the server.");
      }

      default:
        throw new Error(`Unsupported game mode: ${mode}`);
    }

    const room = new Room();
    // INIT BOT
    // let bot = null;
    // END
    const controller = createController({
      room,
      sides: humanSides,
      dispose: () => {
        // bot?.stop();
        room.destroy();
      },
    });
    // INIT BOT
    // if (botSides.length > 0) {
    //   bot = attachBot(room, {
    //     sides: botSides,
    //     delay: botDelay,
    //   });
    // }
    // END

    return controller;
  },

  // @ts-ignore
  loadUI: () => import("./ui/index.js"), // lazy
};
