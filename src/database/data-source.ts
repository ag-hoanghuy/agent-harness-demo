import 'dotenv/config';
import { DataSource } from 'typeorm';
import { createTypeOrmOptions } from './typeorm.config.js';

const appDataSource = new DataSource(createTypeOrmOptions());

export default appDataSource;
