export class Utils {
  static validateId(id) {
    return /[a-zA-Z0-9]{5,64}/.test(id);
  }

  static resolveId(req) {
    if (process.env.URL_SCHEME === 'subdomain') {
      return req.hostname.replace(`${process.env.HOST}`, '').replace(/\./g, '');
    }

    const pathParts = req.path.split('/');
    return pathParts.length < 2 ? '' : pathParts[1];
  }
}
