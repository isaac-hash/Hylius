import chalk from 'chalk';
import ora from 'ora';
/**
 * Examples of colored terminal output with chalk and ora
 *
 * Run this file with: tsx examples/colored-output.ts
 */
console.log(chalk.blue.bold('\n=== Chalk Color Examples ===\n'));
// Basic colors
console.log(chalk.red('Error message'));
console.log(chalk.green('Success message'));
console.log(chalk.yellow('Warning message'));
console.log(chalk.blue('Info message'));
console.log(chalk.cyan('Highlight message'));
console.log(chalk.gray('Muted message'));
// Styles
console.log(chalk.bold('Bold text'));
console.log(chalk.italic('Italic text'));
console.log(chalk.underline('Underlined text'));
console.log(chalk.strikethrough('Strikethrough text'));
console.log(chalk.dim('Dimmed text'));
// Combined styles
console.log(chalk.red.bold('Bold red error'));
console.log(chalk.green.underline('Underlined success'));
console.log(chalk.blue.italic('Italic info'));
// Background colors
console.log(chalk.bgRed.white(' Error '));
console.log(chalk.bgGreen.black(' Success '));
console.log(chalk.bgYellow.black(' Warning '));
// Template literals
const name = 'anvil';
const version = '1.0.0';
console.log(chalk.blue(`\nRunning ${chalk.bold(name)} v${version}`));
// Complex formatting
console.log(chalk.cyan('\nNext steps:'));
console.log(chalk.white(`  $ ${chalk.bold('anvil dev')}  ${chalk.dim('# Start development')}`));
console.log(chalk.white(`  $ ${chalk.bold('anvil build')} ${chalk.dim('# Build production image')}`));
// RGB colors (for more precise colors)
console.log(chalk.rgb(123, 45, 67)('\nCustom RGB color'));
console.log(chalk.hex('#DEADED')('Custom hex color'));
console.log(chalk.blue.bold('\n=== Ora Spinner Examples ===\n'));
// Example 1: Simple spinner
async function example1() {
    const spinner = ora('Loading...').start();
    await new Promise(resolve => setTimeout(resolve, 2000));
    spinner.succeed('Done!');
}
// Example 2: Changing spinner text
async function example2() {
    const spinner = ora('Step 1/3').start();
    await new Promise(resolve => setTimeout(resolve, 1000));
    spinner.text = 'Step 2/3';
    await new Promise(resolve => setTimeout(resolve, 1000));
    spinner.text = 'Step 3/3';
    await new Promise(resolve => setTimeout(resolve, 1000));
    spinner.succeed(chalk.green('All steps completed'));
}
// Example 3: Different completion states
async function example3() {
    let spinner = ora('This will succeed').start();
    await new Promise(resolve => setTimeout(resolve, 1000));
    spinner.succeed('Success!');
    spinner = ora('This will fail').start();
    await new Promise(resolve => setTimeout(resolve, 1000));
    spinner.fail('Failed!');
    spinner = ora('This will warn').start();
    await new Promise(resolve => setTimeout(resolve, 1000));
    spinner.warn('Warning!');
    spinner = ora('This will just stop').start();
    await new Promise(resolve => setTimeout(resolve, 1000));
    spinner.info('Information');
}
// Example 4: Spinner with colors
async function example4() {
    const spinner = ora({
        text: 'Downloading...',
        color: 'cyan',
        spinner: 'dots'
    }).start();
    await new Promise(resolve => setTimeout(resolve, 2000));
    spinner.succeed(chalk.green('Download complete!'));
}
// Run examples
(async () => {
    await example1();
    await example2();
    await example3();
    await example4();
    console.log(chalk.green.bold('\n✨ All examples complete!\n'));
})();
/**
 * Common Spinner Types:
 * - dots (default)
 * - line
 * - pipe
 * - star
 * - arrow
 * - bouncingBar
 * - circle
 *
 * Available Colors:
 * - black, red, green, yellow, blue, magenta, cyan, white, gray
 */
//# sourceMappingURL=colored-output.js.map