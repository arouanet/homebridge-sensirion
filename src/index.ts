import type { API } from 'homebridge';
import { SensirionAccessory } from './accessory';

export = (api: API): void => {
  api.registerAccessory("sensirion", SensirionAccessory);
};
