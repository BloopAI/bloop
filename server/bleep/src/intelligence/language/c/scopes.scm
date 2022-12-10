;; scopes

;; blocks
(compound_statement) @local.scope
(for_statement) @local.scope
(case_statement) @local.scope
(field_declaration_list) @local.scope

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
     (function_declarator) @local.scope)])

;; 2. function definitions
(function_definition) @local.scope

;; similar logic applies to typedefs with functions
;; in them
(type_definition
  (function_declarator) @local.scope)


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

(declaration
  (identifier) @local.definition.variable)

(declaration
  (init_declarator
    declarator: (identifier) @local.definition.variable))

(parameter_declaration
  (identifier) @local.definition.variable)

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

;; typedef struct { int e; } X;
(type_definition
  (type_identifier) @local.definition.typedef)

;; function definition
(function_declarator
  (identifier) @hoist.definition.function)

;; labels
(labeled_statement
  (statement_identifier) @local.definition.label)



;; refs

;; abc;
(expression_statement
  (identifier) @local.reference)

;; (abc)
(parenthesized_expression
  (identifier) @local.reference)

;; !z
(unary_expression
  (identifier) @local.reference)

;; a + b
(binary_expression
  (identifier) @local.reference)

;; a ? b : c
(conditional_expression
  (identifier) @local.reference)

;; ++a
(update_expression
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

;; type refs in declarations
(declaration
  type:
  [(struct_specifier (type_identifier) @local.reference)
   (enum_specifier   (type_identifier) @local.reference)
   (union_specifier  (type_identifier) @local.reference)
                     (type_identifier) @local.reference])

;; type refs in field declarations
(field_declaration
  type:
  [(struct_specifier (type_identifier) @local.reference)
   (enum_specifier   (type_identifier) @local.reference)
   (union_specifier  (type_identifier) @local.reference)
                     (type_identifier) @local.reference])

;; type refs in return types
(function_definition
  type:
  [(struct_specifier (type_identifier) @local.reference)
   (enum_specifier   (type_identifier) @local.reference)
   (union_specifier  (type_identifier) @local.reference)
                     (type_identifier) @local.reference])

;; type refs in params
(parameter_declaration
  type:
  [(struct_specifier (type_identifier) @local.reference)
   (enum_specifier   (type_identifier) @local.reference)
   (union_specifier  (type_identifier) @local.reference)
                     (type_identifier) @local.reference])

;; type refs in casts
(cast_expression
  type: 
  (type_descriptor
    [(struct_specifier (type_identifier) @local.reference)
     (enum_specifier   (type_identifier) @local.reference)
     (union_specifier  (type_identifier) @local.reference)
                       (type_identifier) @local.reference]))

;; type refs in casts

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

;; goto a;
(goto_statement
  (statement_identifier) @local.reference)

;; case ident:
;;    stmt;
(case_statement
  (identifier) @local.reference)
