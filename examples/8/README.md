# JSON Prettifier

This is a simple Python script that reads a JSON file, prettifies it (i.e., formats it in a more human-readable way), and writes the result to an output file.

## Requirements
- Python 3

## Usage
To use this script, run the following command in your terminal:

```bash
python json_prettifier.py input.json output.json
```

Replace `json_prettifier.py` with the name you saved the Python script as, `input.json` with the path to your input JSON file, and `output.json` with the path where you want the output file to be saved.

Here is a brief explanation of the command-line arguments:

- `input.json`: Path to the input JSON file that you want to prettify.
- `output.json`: Path to the output file where the prettified JSON will be written.

## Example
If you have a JSON file at `/path/to/your/input.json` and you want to write the prettified JSON to `/path/to/your/output.json`, you would use the following command:

```bash
python json_prettifier.py /path/to/your/input.json /path/to/your/output.json
```

After running this command, you should see a message like this in your terminal:

```bash
Prettified JSON data has been written to /path/to/your/output.json
```

## Error Handling
If an error occurs (for example, if the input file does not exist), an error message will be printed to the console.
