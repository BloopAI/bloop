;; scopes

;; function declarations create a scope for
;; their args, and another for their bodies
;;
;;     func f(x uint64, y uint64) {
;;        var z = 2
;;     }
;;
;; should resolve to:
;;
;;     scope: {
;;       defs: f
;;       scope: {
;;         defs: x, y
;;         scope: {
;;           defs: z
;;         }
;;       }
;;     }
;;
(function_declaration) @local.scope
(method_declaration) @local.scope
(func_literal) @local.scope
(field_declaration_list) @local.scope
(type_switch_statement) @local.scope
(type_declaration) @local.scope

(block) @local.scope

;; select statements with assignments seem
;; to create scopes, without using blocks
;;
;; select {
;;    case x := <- channel:   // creates a scope and defines `x`
;;      doThing(x)
;;    case y := <- channel:
;;      doThing(y)
;; }
(communication_case) @local.scope


;; defs

;; const x = ...
(const_declaration
  (const_spec
    (identifier) @local.definition.const))

;; var x = ...
(var_declaration
  (var_spec
    (identifier) @local.definition.var))

;; x := ...
(short_var_declaration
  left:
  (expression_list
    (identifier) @local.definition.var))

;; func x() { ... }
(function_declaration
  name: (identifier) @hoist.definition.func)

;; func (s S) x() { ... }
(method_declaration
  name: (field_identifier) @hoist.definition.func)

;; type a struct { ... }
(type_declaration
  (type_spec 
    (type_identifier) @hoist.definition.struct
    (struct_type)))

;; type a interface { ... }
(type_declaration
  (type_spec 
    (type_identifier) @hoist.definition.interface
    (interface_type)))

;; interface methods
(method_spec
  (field_identifier) @local.definition.func)

;; type a b
;; all other type defs
(type_declaration 
  (type_spec 
    (type_identifier) @hoist.definition.type
    [(array_type)
     (channel_type)
     (function_type)
     (map_type)
     (pointer_type)
     (qualified_type)
     (slice_type)
     (type_identifier) @local.reference.type]))

;; type parameters
(type_parameter_list
  (parameter_declaration
    (type_identifier) @local.definition.type))

;; type alias lhs
(type_alias
  .
  (type_identifier) @local.definition.type)

;; type _ struct {
;;    x T
;; }
(field_declaration_list
  (field_declaration 
    (field_identifier) @local.definition.member))

;; func _(x)
(function_declaration
  parameters: 
  (parameter_list
    (parameter_declaration
      (identifier) @local.definition.var)))

;; method params
(method_declaration 
  receiver:
  (parameter_list
    (parameter_declaration
      (identifier) @local.definition.var)))

(method_declaration
  parameters:
  (parameter_list
    (parameter_declaration
      (identifier) @local.definition.var)))

;; variadic params
;; func _(x ... T)
(parameter_list
  (variadic_parameter_declaration
    (identifier) @local.definition.var))

;; function literal syntax
;; const _ = func(x) {}
(func_literal
  (parameter_list
    (parameter_declaration
      (identifier) @local.definition.var)))

;; loop: for i := ...
(labeled_statement 
  (label_name) @local.definition.label)

;; imports
(import_spec 
  (package_identifier) @local.import)

;; switch t := q.(type)
(type_switch_statement
  (expression_list
    (identifier) @local.definition.var))

;; select {
;;    case x := <- c
;; }
;;
;; beats me why this is different from
;; short_var_declaration :shrug:
(receive_statement
  left: 
  (expression_list
    (identifier) @local.definition.var))

;; for range
;;
;; for i, e := range
;;
;; `i` and `e` are def
(for_statement
  (range_clause
    (expression_list 
      (identifier) @local.definition.var)))


;; refs

;; a op b
(binary_expression
  (identifier) @local.reference.var)

;; x()
(call_expression
  (identifier) @local.reference.var)

;; x(ident, ident)
;;
;; arguments to a call expression also create references
(call_expression 
  (argument_list
    (identifier) @local.reference.var))

;; x[_]
(index_expression
  (identifier) @local.reference.var)

;; (x)
(parenthesized_expression
  (identifier) @local.reference.var)

;; x.b
(selector_expression
  . (identifier) @local.reference)

;; x[y:z]
(slice_expression
  (identifier) @local.reference.var)

;; a.(Type)
(type_assertion_expression
  (identifier) @local.reference.var)
(type_assertion_expression
  (type_identifier) @local.reference.type)

;; Type(x)
;;
;; some type conversions are equivalent
;; to call expressions, the grammar lacks
;; info to distinguish among them
(type_conversion_expression
  (identifier) @local.reference)

;; !a
(unary_expression
  (identifier) @local.reference.var)

;; x <- item
(send_statement
  (identifier) @local.reference.var)

;; x := <- c
(send_statement
  (identifier) @local.reference.var)

;; x++
(inc_statement
  (identifier) @local.reference.var)

;; x--
(dec_statement
  (identifier) @local.reference.var)

;; assignment
;; a = 2
(assignment_statement
  (expression_list
    (identifier) @local.reference.var))

;; if x { .. }
(if_statement 
  (identifier) @local.reference.var)

;; switch x { .. }
(expression_switch_statement
  (identifier) @local.reference.var)

;; typed-switch
(type_switch_statement
  (identifier) @local.reference.var)

;; defer x
(defer_statement
  (identifier) @local.reference.var)

;; go x
(go_statement
  (identifier) @local.reference.var)

;; return x
(return_statement
  (expression_list 
    (identifier) @local.reference.var))

;; break x
(break_statement
  (label_name) @local.reference.label)

;; continue x
(continue_statement
  (label_name) @local.reference.label)

;; for range
;;
;; `i` and `e` are def
(for_statement
  (range_clause
    right: (identifier) @local.reference.var))

;; return parameter list
(function_declaration
  result: 
  (parameter_list
    (parameter_declaration 
      (identifier) @local.reference.var)))
(method_declaration
  result: 
  (parameter_list
    (parameter_declaration 
      (identifier) @local.reference.var)))
(method_spec
  result: 
  (type_identifier) @local.definition.type)

;; struct literals
(literal_value
  [
   ;; field: value
   (keyed_element
     (literal_element
       (identifier) @local.reference.var))

   ;; value
   (literal_element
     (identifier) @local.reference.var)
   ])

;; _ := y
(short_var_declaration
  right:
  (expression_list
    (identifier) @local.reference.var))


;; type refs

;; func _(var type)
(parameter_list
  (parameter_declaration
    type:
    (type_identifier) @local.reference.type))

;; return type ident
;;
;; func _(..) type {}
(function_declaration
  result: (type_identifier) @local.reference.type)
(method_declaration
  result: (type_identifier) @local.reference.type)

;; func (var... type)
(variadic_parameter_declaration
  type: (type_identifier) @local.reference.type)

;; *T
(pointer_type
  (type_identifier) @local.reference.type)

;; []T
(slice_type
  (type_identifier) @local.reference.type)

;; map type
(map_type
  (type_identifier) @local.reference.type)

;; chan <- Type
(channel_type 
  (type_identifier) @local.reference.type)

;; var x type; const x type
(var_spec 
  (type_identifier) @local.reference.type)
(const_spec
  (type_identifier) @local.reference.type)

;; module.Type
(qualified_type
  (package_identifier) @local.reference.module)

;; struct literal
(composite_literal
  (type_identifier) @local.reference.type)

;; type constraints
(constraint_term
  (type_identifier) @local.reference.type)

;; type alias rhs
(type_alias
  (_)
  (type_identifier) @local.reference.type)

;; generic type
;; Type[T, U]
(generic_type
  (type_identifier) @local.reference.type)
(type_arguments
  (type_identifier) @local.reference.type)

