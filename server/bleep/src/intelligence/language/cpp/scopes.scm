;; scopes

;; blocks
(compound_statement) @local.scope
(for_statement) @local.scope
(for_range_loop) @local.scope
(case_statement) @local.scope
(field_declaration_list) @local.scope
(lambda_expression) @local.scope
(requires_expression) @local.scope
(namespace_definition) @local.scope

;; functions are finicky, the are of two forms:
;;
;; 1. "declaration" with a "function_declarator" descendant
;; 2. "function_definition" node

;; 1. function prototypes
;; these further seem to appear in two forms:
;;
;;    type ident(...);
;;    // or
;;    type *ident(...);
;;
(declaration 
  [(function_declarator) @local.scope
   (pointer_declarator
     (function_declarator) @local.scope)
   (reference_declarator
     (function_declarator) @local.scope)])

;; 2. function definitions
(function_definition) @local.scope

;; similar logic applies to typedefs with functions
;; in them
(type_definition
  (function_declarator) @local.scope)

;; catch blocks create scopes
(catch_clause) @local.scope

;; templates create type variables
;;
;; FIXME: templates are limited to classes for
;; now this is because templates add a level
;; of nesting to all items except classes, which
;; puts items in smaller scopes than the ones they
;; are declared in. 
(template_declaration
  (class_specifier)) @local.scope
(template_declaration
  (concept_definition)) @local.scope


;; defs

;; #include <lib.h>
(preproc_include
  [(system_lib_string)
   (string_literal)] @local.definition.header)

;; #define PI 355/113
(preproc_def
  (identifier) @local.definition.macro)

;; #define AREA(r) PI * r * r
(preproc_function_def
  (identifier) @local.definition.macro)

;; a[SIZE] = {1, 2, ..}
(array_declarator
 declarator: (identifier) @local.definition.variable)
(array_declarator
 declarator: (field_identifier) @local.definition.variable)

;; int (a) = 2;
(parenthesized_declarator
 (identifier) @local.definition.variable)

;; int *a = b;
(pointer_declarator
 (identifier) @local.definition.variable)

;; int &&a = _;
(reference_declarator
  [(identifier)
   (field_identifier)] @local.definition.variable)

(declaration
  (identifier) @local.definition.variable)

(declaration
  (init_declarator
    declarator: (identifier) @local.definition.variable))

;; rhs patterns of a declaration
(structured_binding_declarator
  (identifier) @local.definition.variable)

(parameter_declaration
  (identifier) @local.definition.variable)

(optional_parameter_declaration
  declarator:
  (identifier) @local.definition.variable)

(variadic_parameter_declaration
  (variadic_declarator 
    (identifier) @local.definition.variable))

;; type params in templates
;;
;; FIXME: limited to classes for now
(template_declaration
  (template_parameter_list
    (type_parameter_declaration
      (type_identifier) @local.definition.typedef))
  [(class_specifier)
   (concept_definition)])

;; concepts
(concept_definition
  name: (identifier) @hoist.definition.concept)

;; namespaces
(namespace_definition
  (identifier) @hoist.definition.namespace)

;; for (int a: b) { .. }
;;
;; `a` is a def
(for_range_loop
  declarator: (identifier) @local.definition.variable)

;; structs
(struct_specifier
  name: (type_identifier) @local.definition.struct
  body: (_))

;; unions
(union_specifier
  name: (type_identifier) @local.definition.union
  body: (_))

;; enums
(enum_specifier
  name: (type_identifier) @local.definition.enum
  body: (_))
(enumerator
  name: (identifier) @local.definition.enumerator)

;; classes
(class_specifier
  name: (type_identifier) @hoist.definition.class
  body: (_))
;; class fields
(field_declaration 
  (field_identifier) @local.definition.variable)

;; typedef struct { int e; } X;
(type_definition
  (type_identifier) @local.definition.typedef)

;; function definition
(function_declarator
  (identifier) @hoist.definition.function)
;; methods
(function_declarator
  (field_identifier) @hoist.definition.function)

;; labels
(labeled_statement
  (statement_identifier) @local.definition.label)

;; using statements are declarations
(using_declaration
  (identifier) @local.definition)

;; using a::b;
(using_declaration 
  (qualified_identifier 
    name: (identifier) @local.definition))

;; using a = b;
(alias_declaration
  name: (type_identifier) @local.definition.alias)



;; refs

;; abc;
(expression_statement
  (identifier) @local.reference)

;; (abc)
(parenthesized_expression
  (identifier) @local.reference)

;; a::b
(qualified_identifier
  (namespace_identifier) @local.reference)

;; !z
(unary_expression
  (identifier) @local.reference)

;; a + b
(binary_expression
  (identifier) @local.reference)

;; ++a
(update_expression
  (identifier) @local.reference)

;; a? b : c
(conditional_expression
  (identifier) @local.reference)

;; call(_, _, _)
(call_expression
  (identifier) @local.reference)

;; _(arg, arg, arg)
(argument_list
  (identifier) @local.reference)

;; field access
;;
;; three types of field access:
;; - a[b]: a and b are refs
;; - a.b
;; - a->b
;;
;; a[b]
(subscript_expression
  (identifier) @local.reference)
;; a.b
;; a->b
(field_expression
  .
  (identifier) @local.reference)
;; if the ident is a destructor, we can 
;; attempt to resolve it to its class
(field_expression 
  (_)
  (destructor_name
    (identifier) @local.reference))

;; array[CONST]
;;       ^^^^^ is a ref
(array_declarator
 size: (identifier) @local.reference)

;; comma operator
;; (a, a++, a <= 2)
(comma_expression
  (identifier) @local.reference)

;; ref and deref
(pointer_expression
  (identifier) @local.reference)

;; assignment expressions
(assignment_expression
  (identifier) @local.reference)

;; for (Type a: b) {.. }
;;
;; `Type` is a ref
;; `b` is a ref
(for_range_loop
  type: (type_identifier) @local.reference)
(for_range_loop
  right: (identifier) @local.reference)

(condition_clause
  (identifier) @local.reference)

;; rhs of a concept
(concept_definition
  name: (_)
  (identifier) @local.reference)

;; type refs in declarations
(declaration
  type:
  [(struct_specifier (type_identifier) @local.reference)
   (class_specifier  (type_identifier) @local.reference)
   (enum_specifier   (type_identifier) @local.reference)
   (union_specifier  (type_identifier) @local.reference)
                     (type_identifier) @local.reference])

;; type refs in return types
(function_definition
  type:
  [(struct_specifier (type_identifier) @local.reference)
   (class_specifier  (type_identifier) @local.reference)
   (enum_specifier   (type_identifier) @local.reference)
   (union_specifier  (type_identifier) @local.reference)
                     (type_identifier) @local.reference])

;; type refs in params
(parameter_declaration
  type:
  [(struct_specifier (type_identifier) @local.reference)
   (class_specifier  (type_identifier) @local.reference)
   (enum_specifier   (type_identifier) @local.reference)
   (union_specifier  (type_identifier) @local.reference)
                     (type_identifier) @local.reference])

;; type refs in optional params
(optional_parameter_declaration
  type:
  [(struct_specifier (type_identifier) @local.reference)
   (class_specifier  (type_identifier) @local.reference)
   (enum_specifier   (type_identifier) @local.reference)
   (union_specifier  (type_identifier) @local.reference)
                     (type_identifier) @local.reference])

;; type refs in casts
(cast_expression
  type: 
  (type_descriptor
    [(struct_specifier (type_identifier) @local.reference)
     (class_specifier  (type_identifier) @local.reference)
     (enum_specifier   (type_identifier) @local.reference)
     (union_specifier  (type_identifier) @local.reference)
                       (type_identifier) @local.reference]))

;; type refs in field declarations
(field_declaration
  type:
  [(struct_specifier (type_identifier) @local.reference)
   (class_specifier  (type_identifier) @local.reference)
   (enum_specifier   (type_identifier) @local.reference)
   (union_specifier  (type_identifier) @local.reference)
                     (type_identifier) @local.reference])

;; default value in rhs of field decls.
(field_declaration 
  (identifier) @local.reference)

;; rhs of optional parameter decls.
(optional_parameter_declaration
  default_value:
  (identifier) @local.reference)


;; type refs in friend declarations
(friend_declaration 
  (type_identifier) @local.reference)

;; rhs of a declaration
(init_declarator
  value: (identifier) @local.reference)

;; (void *) a;
(cast_expression
  value: (identifier) @local.reference)

;; (SomeStruct) { .field = ident }
(initializer_pair
  (identifier) @local.reference)
(subscript_designator
  (identifier) @local.reference)

;; lists
(initializer_list
  (identifier) @local.reference)

;; return a;
(return_statement
  (identifier) @local.reference)

;; delete a;
(delete_expression
  (identifier) @local.reference)

;; new T;
(new_expression
  (type_identifier) @local.reference)

;; goto a;
(goto_statement
  (statement_identifier) @local.reference)

;; co_await var;
(co_await_expression 
  (identifier) @local.reference)

;; throw ex;
(throw_statement
  (identifier) @local.reference)

;; (a + ... + b)
(fold_expression
  (identifier) @local.reference)

(lambda_capture_specifier
  (identifier) @local.reference)

;; case ident:
;;    stmt;
(case_statement
  (identifier) @local.reference)

;; inherited classes are refs
(base_class_clause
  (type_identifier) @local.reference)

;; base types in enums are refs
(enum_specifier
  base: (type_identifier) @local.reference)

;; Type{}
(compound_literal_expression
  (type_identifier) @local.reference)

;; operator Type() T;
(operator_cast
  (type_identifier) @local.reference)

;; template types
;; T<_>
(template_type
  (type_identifier) @local.reference)

;; V<_>()
(template_function
  (identifier) @local.reference)

;; _<U, V, W>
(template_argument_list
  (type_descriptor 
    (type_identifier) @local.reference))

;; variadic in type descriptors
(parameter_pack_expansion
  (type_descriptor 
    (type_identifier) @local.reference))

;; a.template F<_>()
(template_method 
  (field_identifier) @local.reference)

;; type constraints
(compound_requirement
  (identifier) @local.reference)
(trailing_return_type
  (type_descriptor 
    (type_identifier) @local.reference))
