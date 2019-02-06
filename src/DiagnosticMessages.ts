/**
 * An object that keeps track of all possible error messages. 
 */
export var diagnosticMessages = {
    //this one won't be used much, we just need a catchall object for the code since we pass through the message from the parser
    Generic_parser_message: {
        message: 'There was an error parsing the file',
        code: 1000,
    },
    Cannot_find_function_name_1001: {
        message: `Cannot find name '{0}'`,
        code: 1001
    },
    Expected_a_arguments_but_got_b_1002: {
        message: 'Expected {0} arguments, but got {1}.',
        code: 1002
    },
    Duplicate_function_implementation_1003: {
        message: 'Duplicate function implementation.',
        code: 1003
    },
    Referenced_file_does_not_exist_1004: {
        message: 'Referenced file does not exist.',
        code: 1004
    },
    Xml_component_missing_component_declaration: {
        message: 'Missing a component declaration',
        code: 1005
    },
    Component_missing_name_attribute: {
        message: 'Component must have a name attribute',
        code: 1006
    },
    Component_missing_extends_attribute: {
        message: 'Component must have an extends attribute',
        code: 1007
    },
    Xml_parse_error: {
        //generic catchall xml parse error
        message: 'Invalid xml',
        code: 1008
    },
    /**
     * This will happen infrequently. Sometimes we can't figure out the range of the 
     * function body because there is a parse error somewhere
     */
    Unknown_brs_parse_error: {
        message: 'Unable to compute function scope due to a parse error',
        code: 1009
    }
}