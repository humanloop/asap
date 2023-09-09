import json
import sys

def prettify_json(input_file_path, output_file_path):
    try:
        # Open the input file, load the JSON data
        with open(input_file_path, 'r') as f:
            data = json.load(f)

        # Open the output file in write mode, write the prettified JSON data
        with open(output_file_path, 'w') as f:
            f.write(json.dumps(data, indent=4))

        print("Prettified JSON data has been written to", output_file_path)
    except Exception as e:
        print("An error occurred:", str(e))

# Get paths from command line arguments
input_file_path = sys.argv[1]
output_file_path = sys.argv[2]

prettify_json(input_file_path, output_file_path)
