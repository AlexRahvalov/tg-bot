declare module 'rcon-client' {
  export interface RconOptions {
    host: string;
    port: number;
    password: string;
    timeout?: number;
    encoding?: string;
  }

  export class Rcon {
    constructor(options: RconOptions);
    
    /**
     * Подключение к RCON серверу
     */
    connect(): Promise<void>;
    
    /**
     * Отправка команды на сервер
     * @param command Команда для выполнения
     */
    send(command: string): Promise<string>;
    
    /**
     * Закрытие соединения
     */
    end(): Promise<void>;
    
    /**
     * Проверка состояния подключения
     */
    readonly connected: boolean;
  }
}