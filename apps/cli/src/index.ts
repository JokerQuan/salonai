#!/usr/bin/env node
import { Command } from 'commander';
import { runHealthCommand } from './health';

const program = new Command();

program.name('salonai').description('SalonAI command line tools').version('0.0.0');

program
  .command('health')
  .description('Check the SalonAI API health endpoint')
  .action(async () => {
    try {
      await runHealthCommand();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      console.error(`SalonAI API unavailable: ${message}`);
      process.exitCode = 1;
    }
  });

program.parseAsync();
