// Updated LocationSimulator.js
require('dotenv').config();
const mongoose = require('mongoose');
const Employee = require('../models/Employee');

const INDIAN_CITIES = [
  { name: "Mumbai", lat: 19.0760, lng: 72.8777, radius: 0.3 },
  { name: "Delhi", lat: 28.7041, lng: 77.1025, radius: 0.4 },
  { name: "Bangalore", lat: 12.9716, lng: 77.5946, radius: 0.5 },
  { name: "Hyderabad", lat: 17.3850, lng: 78.4867, radius: 0.3 },
  { name: "Chennai", lat: 13.0827, lng: 80.2707, radius: 0.3 },
  { name: "Kolkata", lat: 22.5726, lng: 88.3639, radius: 0.3 },
  { name: "Pune", lat: 18.5204, lng: 73.8567, radius: 0.3 },
  { name: "Ahmedabad", lat: 23.0225, lng: 72.5714, radius: 0.3 },
  { name: "Jaipur", lat: 26.9124, lng: 75.7873, radius: 0.3 },
  { name: "Lucknow", lat: 26.8467, lng: 80.9462, radius: 0.3 }
];

class LocationSimulator {
  constructor() {
    this.simulationInterval = null;
    this.employeeCities = new Map(); 
  }

  async connectDB() {
    await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    console.log('Simulator connected to MongoDB');
  }

  async startSimulation() {
    await this.connectDB();
    await this.initializeIndianLocations();
    this.simulationInterval = setInterval(() => this.updateLocations(), 3000);  
    console.log('Location simulation started for Indian cities (updating every 3 seconds)');
  }

  async initializeIndianLocations() {
    try {
      const employees = await Employee.find();

      for (const employee of employees) {
        if (!employee.location ||
          !this.isValidIndianLocation(employee.location.lat, employee.location.lng)) {

          await this.assignIndianCity(employee);
        }
      }
      console.log(`Initialized locations for ${employees.length} employees`);
    } catch (err) {
      console.error('Error initializing locations:', err);
    }
  }

  async assignIndianCity(employee) {
    const city = INDIAN_CITIES[Math.floor(Math.random() * INDIAN_CITIES.length)];
    const { lat, lng } = this.getRandomLocationInCity(city);

    await Employee.findByIdAndUpdate(employee._id, {
      location: {
        lat,
        lng,
        city: city.name,
        lastUpdated: new Date()
      }
    });

    this.employeeCities.set(employee._id.toString(), city);
  }

  getRandomLocationInCity(city) {
    const radius = city.radius * Math.sqrt(Math.random());
    const angle = Math.random() * 2 * Math.PI;

    return {
      lat: city.lat + radius * Math.cos(angle),
      lng: city.lng + radius * Math.sin(angle)
    };
  }

  async updateLocations() {
    try {
      const employees = await Employee.find();

      for (const employee of employees) {
        if (!employee.location) {
          await this.assignIndianCity(employee);
          continue;
        }

        const city = this.employeeCities.get(employee._id.toString()) ||
          INDIAN_CITIES.find(c => c.name === employee.location?.city) ||
          INDIAN_CITIES[Math.floor(Math.random() * INDIAN_CITIES.length)];

        // Get current position
        let lat = Number(employee.location.lat);
        let lng = Number(employee.location.lng);

        const moveTowardsCenter = Math.random() > 0.7;  

        if (moveTowardsCenter) {
          lat += (city.lat - lat) * 0.1 * Math.random();
          lng += (city.lng - lng) * 0.1 * Math.random();
        } else {
          lat += (Math.random() - 0.5) * 0.05;
          lng += (Math.random() - 0.5) * 0.05;
        }

        const distanceFromCenter = this.calculateDistance(lat, lng, city.lat, city.lng);
        if (distanceFromCenter > city.radius) {
          const angle = Math.atan2(lng - city.lng, lat - city.lat);
          lat = city.lat + city.radius * Math.cos(angle);
          lng = city.lng + city.radius * Math.sin(angle);
        }

        await Employee.findByIdAndUpdate(employee._id, {
          location: {
            lat,
            lng,
            city: city.name,
            lastUpdated: new Date()
          }
        });
      }

      console.log(`Updated ${employees.length} employee locations at ${new Date().toLocaleTimeString()}`);
    } catch (err) {
      console.error('Error updating locations:', err);
    }
  }

  calculateDistance(lat1, lng1, lat2, lng2) {
    return Math.sqrt(Math.pow(lat2 - lat1, 2) + Math.pow(lng2 - lng1, 2));
  }

  isValidIndianLocation(lat, lng) {
    return lat >= 8.0 && lat <= 37.0 && lng >= 68.0 && lng <= 97.0;
  }
}

module.exports = new LocationSimulator();