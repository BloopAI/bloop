;; scopes
[(function_definition)
 (declaration_list)
 (compound_statement)
 (if_statement)
 (else_clause)
 (else_if_clause)
 (colon_block)
 (switch_block)
 (case_statement)
 (while_statement)
 (for_statement)
 (foreach_statement)
 (match_expression)
 (match_condition_list)
 (anonymous_function_creation_expression)
 (arrow_function)
 (enum_declaration_list)
 (method_declaration)
 ] @local.scope

;; defs
(assignment_expression
  .
  (variable_name
    (name) @local.definition.variable))

(function_definition
  (name) @hoist.definition.function)

(class_declaration
  (name) @local.definition.class)

(trait_declaration
  (name) @local.definition.trait)

(interface_declaration
  (name) @local.definition.interface)

(method_declaration
  (name) @hoist.definition.method)

(static_variable_declaration
  .
  (variable_name
    (name) @local.definition.constant))

(const_declaration
  .
  (const_element
    (name) @local.definition.constant))

(simple_parameter
  (variable_name
    (name) @local.definition.parameter))

(simple_parameter
  default_value: 
   (name) @local.reference)

(simple_parameter
  default_value: 
   (variable_name
     (name) @local.reference))

(variadic_parameter
  (variable_name
    (name) @local.definition.parameter))

(foreach_statement
  "as"
  (variable_name
    (name) @local.definition.variable))

(list_literal
  (variable_name
    (name) @local.definition.variable))

(named_label_statement
  (name) @local.definition.label)

(property_element
  (variable_name
    (name) @local.definition.field))

(namespace_definition
  (namespace_name) @local.definition.namespace)

(enum_declaration
  (name) @local.definition.enum)

(enum_case
  (name) @local.definition.enumerator)

;; imports

(namespace_use_declaration
  (namespace_use_clause
    .
    (name) @local.import
    .))

(namespace_use_declaration
  (namespace_use_clause
    (namespace_aliasing_clause
      (name) @local.import)))

(namespace_use_declaration
  (namespace_use_clause
    (qualified_name
      (name) @local.import)))

(namespace_use_declaration
  (namespace_use_group
    (namespace_use_group_clause
      (namespace_name
        (name) @local.import))))

;; refs

(assignment_expression
  (variable_name
    (name)@local.reference)
  .)

(augmented_assignment_expression
  (variable_name
    (name) @local.reference))


(static_variable_declaration
  (variable_name
    (name)@local.reference  )
  .)

(echo_statement
  [(variable_name)
   (name)] @local.reference)

(expression_statement
  (function_call_expression
    (name) @local.reference))

(arguments
  (argument
    (name) @local.reference
    .))

(arguments
  (argument
    (variable_name
      (name) @local.reference)))

(global_declaration
  (variable_name
    (name) @local.reference))

(binary_expression
  (variable_name (name)  @local.reference))
(binary_expression
  (name)  @local.reference)

(unary_op_expression
    (variable_name (name) @local.reference))
(unary_op_expression
    (name) @local.reference)

(member_access_expression
  (variable_name
    (name) @local.reference))

(member_call_expression
  object: (variable_name
    (name) @local.reference))
(member_call_expression
  name: (name) @local.reference)

(subscript_expression
  (variable_name (name) @local.reference))
(subscript_expression
  (name) @local.reference)

(return_statement
  (variable_name (name) @local.reference))
(return_statement
  (name) @local.reference)

(update_expression
  (variable_name (name) @local.reference))

(conditional_expression
  (variable_name (name) @local.reference))
(conditional_expression
  (name) @local.reference)

(array_element_initializer
  (variable_name (name) @local.reference))
(array_element_initializer
  (name) @local.reference)

(object_creation_expression
  (variable_name (name) @local.reference))
(object_creation_expression
  (name) @local.reference)

(base_clause 
  (name) @local.reference)

(class_interface_clause
  (name) @local.reference)

(parenthesized_expression
  (variable_name (name) @local.reference))
(parenthesized_expression
  (name) @local.reference)

(expression_statement 
  (variable_name (name) @local.reference))
(expression_statement 
  (name) @local.reference)

(case_statement
  (variable_name (name) @local.reference))
(case_statement
  (name) @local.reference)

(case_statement
  (variable_name (name) @local.reference))
(case_statement
  (name) @local.reference)

(foreach_statement
  .
  (variable_name (name) @local.reference))
(foreach_statement
  .
  (name) @local.reference)

(by_ref
  (variable_name (name) @local.reference))

(encapsed_string
  (variable_name
    (name) @local.reference))

(match_condition_list
  (variable_name
    (name) @local.reference))

(match_conditional_expression
  return_expression: (variable_name
                       (name) @local.reference))

(goto_statement
  (name) @local.reference)

(anonymous_function_use_clause
  (variable_name
    (name) @local.reference))

(scoped_call_expression
  scope: (name) @local.reference)

(scoped_call_expression
  name: (name) @local.reference)

(class_constant_access_expression
  (name) @local.reference)

(class_declaration
  (attribute_list
    (attribute_group
      (attribute
        (name) @local.reference))))

(namespace_use_declaration
  (namespace_name) @local.reference)

;; types
(named_type 
  (name) @local.reference)

