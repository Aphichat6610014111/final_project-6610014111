// Auto-generated static asset index for frontend-only image usage
// Exports a list and a map keyed by filename (lowercased, without extension)
const assetsList = [
  require('./4X4.jpg'),
  require('./adaptive-icon.png'),
  require('./Alloy.jpg'),
  require('./Aluminum Piston.jpg'),
  require('./Aluminum.jpg'),
  require('./Brake Cylinder.jpg'),
  require('./Brake Disc.jpg'),
  require('./Brake Hoses.jpg'),
  require('./Brake Pads.jpg'),
  require('./Bumper.png'),
  require('./Car Engine Clutch.jpg'),
  require('./Car Mats.jpg'),
  require('./Chrome.jpg'),
  require('./Custom.jpg'),
  require('./Cylinder Head Combustion.jpg'),
  require('./Cylinder Head Gasket.jpg'),
  require('./Door Handle.jpg'),
  require('./favicon.png'),
  require('./GPS.jpg'),
  require('./icon.png'),
  require('./images.jpg'),
  require('./Lamps.jpg'),
  require('./Power Steering Pump.jpg'),
  require('./Seat Cover.jpg'),
  require('./splash-icon.png'),
  require('./Steel.jpg'),
  require('./Steering Rack.jpg'),
  require('./Steering Wheel.jpg'),
  require('./Tie Rod for Kia Mustang 2006.jpg'),
  require('./Timing Belt.jpg'),
  require('./Turbocharger.jpg'),
  require('./autoparts-logo.png'), // newly added logo
  require('./Car-Body.jpg'), // background image added
  require('./Wheels and Rims.jpg'),
  require('./Engine.jpg'),
  require('./Vehicle Body Parts.jpg'),
  require('./Accessories.jpg'),
  require('./FooterCar.jpg'), // footer background image
  require('./Lamps2.jpg'), // duplicate entry to test handling
];

const makeKey = (filename) => filename.replace(/\.[^/.]+$/, '').toLowerCase();

const assetsMap = {};
const filenames = [
  '4X4.jpg',
  'adaptive-icon.png',
  'Alloy.jpg',
  'Aluminum Piston.jpg',
  'Aluminum.jpg',
  'Brake Cylinder.jpg',
  'Brake Disc.jpg',
  'Brake Hoses.jpg',
  'Brake Pads.jpg',
  'Bumper.png',
  'Car Engine Clutch.jpg',
  'Car Mats.jpg',
  'Chrome.jpg',
  'Custom.jpg',
  'Cylinder Head Combustion.jpg',
  'Cylinder Head Gasket.jpg',
  'Door Handle.jpg',
  'favicon.png',
  'GPS.jpg',
  'icon.png',
  'images.jpg',
  'Lamps.jpg',
  'Power Steering Pump.jpg',
  'Seat Cover.jpg',
  'splash-icon.png',
  'Steel.jpg',
  'Steering Rack.jpg',
  'Steering Wheel.jpg',
  'Tie Rod for Kia Mustang 2006.jpg',
  'Timing Belt.jpg',
  'Turbocharger.jpg',
  'autoparts-logo.png', // newly added logo filename
  'Car-Body.jpg', // background image filename
  'Wheels and Rims.jpg',
  'Engine.jpg',
  'Vehicle Body Parts.jpg',
  'Accessories.jpg',
  'FooterCar.jpg', // footer background image filename
  'Lamps2.jpg', // duplicate entry to test handling
];

filenames.forEach((f, i) => {
  const k = makeKey(f);
  if (!assetsMap[k]) assetsMap[k] = assetsList[i];
});

export default {
  list: assetsList,
  map: assetsMap,
};
