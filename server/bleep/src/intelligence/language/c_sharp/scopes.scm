;; scopes
[
 (block)
 (switch_expression_arm)
 (anonymous_method_expression)
 (lambda_expression)

 ;; functions
 (local_function_statement)
 (arrow_expression_clause)

 ;; switch statements
 (switch_section)
 (case_pattern_switch_label)

 ;; namespaces
 (namespace_declaration)

 ;; class items
 (class_declaration)
 (constructor_declaration)
 (destructor_declaration)
 (indexer_declaration)
 (method_declaration)
 
 ;; enum items
 (enum_member_declaration_list)

 ;; interface items
 (interface_declaration)

 ;; record items
 (record_declaration)
 (record_struct_declaration)

 ;; struct items
 (struct_declaration)

 ;; catch statements
 (catch_clause)

 ;; using statement:
 ;; 
 ;; using (var a = b) { .. }
 (using_statement)

 ;; fixed statement:
 ;;
 ;; fixed (var a = b) { .. }
 (fixed_statement)

 ;; for (int i = 0; cond; step) { .. }
 (for_statement)

 ;; foreach(int x in y) { .. }
 (for_each_statement)
] @local.scope

;; defs

;; var declarations
(variable_declarator
  (identifier) @local.definition.local)

(declaration_expression
  (identifier) @local.definition.local)

;; namespaces
(namespace_declaration 
  (identifier) @hoist.definition.namespace)

;; classes
;;
;; - class name
;; - type params
;; - constructors
;; - destructors

(class_declaration
  name: (identifier) @hoist.definition.class)
(constructor_declaration
  name: (identifier) @hoist.definition.method)
(destructor_declaration 
  name: (identifier) @hoist.definition.method)
(method_declaration 
  name: (identifier) @hoist.definition.method)

;; enums
(enum_declaration
  (identifier) @local.definition.enum)
(enum_member_declaration
  (identifier) @local.definition.enumerator)

;; interfaces
(interface_declaration
  name: (identifier) @hoist.definition.interface)

;; records
;;
;; record F {}
(record_declaration 
  name: (identifier) @hoist.definition.class)
;; record struct F {}
(record_struct_declaration 
  name: (identifier) @hoist.definition.struct)

;; structs
(struct_declaration
  name: (identifier) @hoist.definition.struct)

;; functions
(local_function_statement
  name: (identifier) @hoist.definition.local)


;; patterns are defs
;; x is a
(constant_pattern
  (identifier) @local.definition.local)

;; x is var a
(var_pattern
  (identifier) @local.definition.local)

;; (x, y, z) = _
(tuple_pattern
  (identifier) @local.definition.local)

;; x is var (x, y)
(parenthesized_variable_designation
  (identifier) @local.definition.local)

;; x is var a
(declaration_pattern
  name: (identifier) @local.definition.local)

;; params are defs
(parameter
  name: (identifier) @local.definition.local)

;; type params make defs
(type_parameter 
  (identifier) @local.definition.typedef)

;; [params string[] args]
(bracketed_parameter_list
  (identifier) @local.definition.local)

;; lambda params
(lambda_expression
  (modifier)*
  .
  (identifier) @local.definition.local)

;; catch (Exception ex) {}
(catch_declaration
  name: (identifier) @local.definition.local)

;; foreach(Type x in y) { .. }
;; 
;; `Type` is a ref
;; `x` is a def
;; `y` is a ref
(for_each_statement
  left: (identifier) @local.definition.local)

;; imports

;; using System.Text
;; 
;; `Text` is an import
(using_directive
  .
  (qualified_name
    (_)
    .
    (identifier) @local.import))

;; using Named = System.Text;
;;
;; `Named` is a def
(using_directive
  (name_equals
    (identifier) @local.import))


;; refs

(binary_expression
  (identifier) @local.reference)

;; ternary expr
(conditional_expression
  (identifier) @local.reference)

;; a;
(expression_statement
  (identifier) @local.reference)

;; x is int
(is_expression
  (identifier) @local.reference)
;; x is String 
(is_pattern_expression
  (identifier) @local.reference)

;; ident as Type
(as_expression
  (identifier) @local.reference)

;; ++x
(prefix_unary_expression
  (identifier) @local.reference)
;; x++
(postfix_unary_expression
  (identifier) @local.reference)

;; a = b
(assignment_expression
  (identifier) @local.reference)

;; rhs of equal to signs
;;
;; _ = b
(equals_value_clause
  (identifier) @local.reference)

;; (Type)v
(cast_expression
  type: (identifier) @local.reference)
(cast_expression
  value: (identifier) @local.reference)

;; a[]
(element_access_expression
  (identifier) @local.reference)

;; range exprs
(range_expression
  (identifier) @local.reference)

;; function or array args
(argument 
  (identifier) @local.reference)

;; ident switch {}
(switch_expression
  (identifier) @local.reference)
(switch_expression_arm 
  (identifier) @local.reference)

;; checked(ident)
(checked_expression
  (identifier) @local.reference)

;; __makeref(ident)
(make_ref_expression
  (identifier) @local.reference)

;; __reftype(ident)
(ref_type_expression
  (identifier) @local.reference)

;; __refvalue(ident, type)
(ref_value_expression
  (identifier) @local.reference)

;; sizeof(type)
(size_of_expression
  (identifier) @local.reference)

;; typeof(ident)
(type_of_expression
  (identifier) @local.reference)

;; default(Type)
(default_expression
  (identifier) @local.reference)

;; new Obj {}
(object_creation_expression
  (identifier) @local.reference)

;; foo() 
(invocation_expression
  (identifier) @local.reference)

;; A.b
(member_access_expression
  .
  (identifier) @local.reference)

;; this.b
;;
;; we can resolve `b` here
(member_access_expression
  (this_expression)
  (identifier) @local.reference)

;; return t
(return_statement
  (identifier) @local.reference)

;; await t
(await_expression
  (identifier) @local.reference)

;; throw t
(throw_expression
  (identifier) @local.reference)

;; lock (mutex)
(lock_statement
  (identifier) @local.reference)

;; lambda body
(lambda_expression 
  body: (identifier) @local.reference)

;; new [] {a, b, c}
(initializer_expression
  (identifier) @local.reference)

;; b?.member
(conditional_access_expression
  condition: (identifier) @local.reference)

;; (a)
(parenthesized_expression
  (identifier) @local.reference)

;; A.b
(qualified_name
  .
  (identifier) @local.reference)

;; $"Good morning {name}"
(interpolation
  (identifier) @local.reference)

;; record updates
;;
;; item with { field = new_field, }
(with_expression
  (identifier) @local.reference)
(simple_assignment_expression
  (identifier)
  "="
  (identifier) @local.reference)

;; while (ident) { .. }
(while_statement
  (identifier) @local.reference)

;; do { .. } while (ident)
(do_statement
  (identifier) @local.reference)

;; if (ident) { .. }
(if_statement
  (identifier) @local.reference)

;; switch (ident) { .. }
;;
;; different from switch_expression
(switch_statement
  (identifier) @local.reference)
(when_clause
  (identifier) @local.reference)

;; foreach(Type x in y) { .. }
;; 
;; `Type` is a ref
;; `x` is a def
;; `y` is a ref
(for_each_statement
  type: (identifier) @local.reference)
(for_each_statement
  right: (identifier) @local.reference)


;; type refs

;; Type?
(nullable_type
  (identifier) @local.reference)

;; types in params
(parameter
  type: (identifier) @local.reference)

;; Type[]
(array_type
  (identifier) @local.reference)
(array_rank_specifier
  (identifier) @local.reference)

;; tuple types
(tuple_element
  type: (identifier) @local.reference)

;; generics
(generic_name
  (identifier) @local.reference)
(generic_name
  (type_argument_list
    (identifier) @local.reference))

;; type ref in pattern
(declaration_pattern
  type: (identifier) @local.reference)

;; catch decl
(catch_declaration
  type: (identifier) @local.reference)

;; type ref in object patterns
(recursive_pattern
  (identifier) @local.reference)

;; type patterns
(type_pattern
  (identifier) @local.reference)

;; type constraints
(type_parameter_constraints_clause
  (identifier) @local.reference)
(type_constraint 
  (identifier) @local.reference)

;; base types in enums & interfaces
;;
;; enum Direction: Type {
;;    ...
;; }
(base_list
  (identifier) @local.reference)

(base_list
  (primary_constructor_base_type
    (identifier) @local.reference))

;; function return type
(local_function_statement 
  type: (identifier) @local.reference)
