/**
 * An object that keeps track of all possible error messages.
 */
export let diagnosticMessages = {
    //this one won't be used much, we just need a catchall object for the code since we pass through the message from the parser
    Generic_parser_message: {
        message: 'There was an error parsing the file',
        code: 1000,
    },
    Call_to_unknown_function_1001: {
        message: `Cannot find name '{0}'`,
        code: 1001
    },
    Expected_a_arguments_but_got_b_1002: {
        message: 'Expected {0} arguments, but got {1}.',
        code: 1002
    },
    Duplicate_function_implementation_1003: {
        message: 'Duplicate function implementation for "{0}" when included in scope "{1}".',
        code: 1003
    },
    Referenced_file_does_not_exist_1004: {
        message: 'Referenced file does not exist.',
        code: 1004
    },
    Xml_component_missing_component_declaration_1005: {
        message: 'Missing a component declaration.',
        code: 1005
    },
    Component_missing_name_attribute_1006: {
        message: 'Component must have a name attribute.',
        code: 1006
    },
    Component_missing_extends_attribute_1007: {
        message: 'Component must have an extends attribute.',
        code: 1007
    },
    Xml_parse_error_1008: {
        //generic catchall xml parse error
        message: 'Invalid xml',
        code: 1008
    },
    Unnecessary_script_import_in_child_from_parent_1009: {
        message: 'Unnecessary script import: Script is already imported in ancestor component "{0}".',
        code: 1009
    },
    Shadows_ancestor_function_1010: {
        message: 'Function "{0}" included in "{1}" shadows function in "{2}" included in "{3}".',
        code: 1010
    },
    Local_var_shadows_global_function_1011: {
        message: 'Local var "{0}" has same name as global function in "{1}" and will never be called.',
        code: 1011
    },
    Script_import_case_mismatch_1012: {
        message: 'Script import path does not match casing of actual file path "{0}".',
        code: 1012
    },
    File_not_referenced_by_any_file_1013: {
        message: 'This file is not referenced by any other file in the project.',
        code: 1013
    },
    Unknown_diagnostic_code_1014: {
        message: 'Unknown diagnostic code {0}',
        code: 1014
    },
    Script_src_cannot_be_empty_1015: {
        message: 'Script import cannot be empty or whitespace',
        code: 1015
    }
};

let allCodes = [];
for (let key in diagnosticMessages) {
    allCodes.push(diagnosticMessages[key].code);
}

export let diagnosticCodes = allCodes;
