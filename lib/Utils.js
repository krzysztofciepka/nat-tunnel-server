export class Utils {
  static validateId(id) {
    return /[a-zA-Z0-9]{5,64}/.test(id);
  }
}
