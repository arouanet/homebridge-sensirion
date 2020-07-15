import type { BytesWritten, PromisifiedBus } from 'i2c-bus';

import { wait } from './util';

class Sensor {

  constructor(readonly bus: PromisifiedBus, readonly address: number) {
  }

  static checksum(data: Buffer): number {
    let crc = 0xff;
    for (const byte of data) {
      crc ^= byte;
      for (let i = 0; i < 8; i++) {
        crc = crc & 0x80 ? (crc << 1) ^ 0x31 : crc << 1;
        crc &= 0xff;
      }
    }
    return crc;
  }

  sendCommand(command: number) {
    const buffer = Buffer.alloc(2);
    buffer.writeUInt16BE(command, 0);
    return this.bus.i2cWrite(this.address, buffer.length, buffer);
  }

  readData(n: number): Promise<number[]> {
    const buffer = Buffer.allocUnsafe(n * 3);
    return this.bus.i2cRead(this.address, buffer.length, buffer)
      .then(({buffer}) => {
        const data = [];
        for (let offset = 0; offset < buffer.length; offset += 3) {
          const crc = buffer.readUInt8(offset + 2);
          if (Sensor.checksum(buffer.slice(offset, offset + 2)) !== crc) {
            throw new Error("CRC Error");
          }
          data.push(buffer.readUInt16BE(offset));
        }
        return data;
      });
  }
}

/**
 * Air quality sensor
 */
export class AirQualitySensor extends Sensor {

  constructor(bus: PromisifiedBus) {
    super(bus, 0x58);
  }

  init(): Promise<NodeJS.Timeout> {
    return this.sendCommand(0x2003)
      .then(() => wait(10));
  }

  measure(): Promise<AirQualityData> {
    return this.sendCommand(0x2008)
      .then(() => wait(12))
      .then(() => this.readData(2))
      .then(([co2eq, tvoc]) => ({co2eq, tvoc}));
  }
}

export interface AirQualityData { co2eq: number; tvoc: number }
