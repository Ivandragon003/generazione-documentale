// Configuration for the MAC Documents API client SDK
// Set basePath to the server you want to target:
//   - Mock server (oas3-tools): http://localhost:8080
//   - NestJS real server:       http://localhost:3000

export interface ConfigurationParameters {
  apiKey?: string | ((name: string) => string);
  username?: string;
  password?: string;
  accessToken?: string | (() => string);
  basePath?: string;
}

export class Configuration {
  apiKey?: string | ((name: string) => string);
  username?: string;
  password?: string;
  accessToken?: string | (() => string);
  basePath?: string;

  constructor(param: ConfigurationParameters = {}) {
    this.apiKey = param.apiKey;
    this.username = param.username;
    this.password = param.password;
    this.accessToken = param.accessToken;
    // Default to mock server in development
    this.basePath = param.basePath || 'http://localhost:8080';
  }
}
