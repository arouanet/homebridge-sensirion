import type {
  AccessoryConfig,
  AccessoryPlugin,
  API,
  CharacteristicGetCallback,
  Logging,
  Service,
} from 'homebridge';

import { openPromisified } from 'i2c-bus';

import type { AirQualityData } from './sensors';
import { AirQualitySensor } from './sensors';
import { vocDensity } from './util';

interface SensirionConfig extends AccessoryConfig {
  bus?: number;
}

export class SensirionAccessory implements AccessoryPlugin {

  private readonly informationService: Service;
  private readonly airQualityService: Service;

  private airQualityData: AirQualityData | undefined;

  constructor(readonly log: Logging, config: SensirionConfig, api: API) {
    openPromisified(config.bus ?? 1)
      .then(bus => {
        const airQualitySensor = new AirQualitySensor(bus);
        airQualitySensor.init()
          .then(() => {
            setInterval(this.measure.bind(this, airQualitySensor), 1000);
          })
          .catch(error => { bus.close(); throw error; });
      })
      .catch(error => log.error(error.message));

    this.airQualityService = new api.hap.Service.AirQualitySensor();

    // Indoor Air Quality levels by the German Federal Environmental Agency

    const airQuality = (tvoc?: number) => {
      if (tvoc === undefined) {
        return api.hap.Characteristic.AirQuality.UNKNOWN;
      }
      if (tvoc < 65) {
        return api.hap.Characteristic.AirQuality.EXCELLENT;
      } else if (tvoc < 220) {
        return api.hap.Characteristic.AirQuality.GOOD;
      } else if (tvoc < 660) {
        return api.hap.Characteristic.AirQuality.FAIR;
      } else if (tvoc < 2200) {
        return api.hap.Characteristic.AirQuality.INFERIOR;
      } else {
        return api.hap.Characteristic.AirQuality.POOR;
      }
    };

    this.airQualityService.getCharacteristic(api.hap.Characteristic.AirQuality)
      .on(api.hap.CharacteristicEventTypes.GET, (callback: CharacteristicGetCallback) => {
        callback(undefined, airQuality(this.airQualityData?.tvoc));
      });

    this.airQualityService.getCharacteristic(api.hap.Characteristic.VOCDensity)
      .on(api.hap.CharacteristicEventTypes.GET, (callback: CharacteristicGetCallback) => {
        callback(undefined, vocDensity(this.airQualityData?.tvoc ?? 0));
      });

    this.informationService = new api.hap.Service.AccessoryInformation()
      .setCharacteristic(api.hap.Characteristic.Manufacturer, "Sensirion")
      .setCharacteristic(api.hap.Characteristic.Model, "SGP30");
  }

  measure(airQualitySensor: AirQualitySensor): void {
    airQualitySensor.measure()
      .then(data => {
        this.log.debug(`CO₂eq: ${data.co2eq} ppm, TVOC: ${data.tvoc} ppb`);
        this.airQualityData = data;
      })
      .catch(error => this.log.warn(error.message));
  }

  getServices(): Service[] {
    return [
      this.informationService,
      this.airQualityService,
    ];
  }
}
