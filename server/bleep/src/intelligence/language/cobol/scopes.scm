;; there are no scopes to a cobol program

(program_name) @local.definition.program

;; defs
(file_description
  (file_description_entry
    (WORD) @local.definition.file))
(data_description
  (entry_name) @local.definition.data)
(paragraph_header
  name: (_) @local.definition.paragraph)

;; refs
(select_statement
  file_name: (_) @local.reference)
(select_statement
  (assign_clause
    to: (qualified_word
          (WORD) @local.reference)))

(copy_statement
  book: (_) @local.reference)

(record_key_clause
  reference: (qualified_word 
               (WORD) @local.reference))

(file_status_clause
  reference: (qualified_word 
               (WORD) @local.reference))

(read_statement
  file_name: (_) @local.reference)

(read_statement
  into: (qualified_word
          (WORD) @local.reference))

(release_statement
  record: (qualified_word
            (WORD) @local.reference))

(release_statement
  from: (qualified_word
          (WORD) @local.reference))

(return_statement
  file_name: (WORD) @local.reference)

(return_statement
  into: (qualified_word
          (WORD) @local.reference))

(rewrite_statement
  record: (qualified_word
            (WORD) @local.reference)
  from: (qualified_word
            (WORD) @local.reference))

(search_statement
  table_name: (qualified_word
                (WORD) @local.reference))

(search_statement
  varying: (qualified_word 
             (WORD) @local.reference))

(set_statement
  (set_environment
    (qualified_word 
      (WORD) @local.reference)))

(set_statement
  (set_to
    (qualified_word 
      (WORD) @local.reference)))

(set_statement
  (set_up_down
    (qualified_word 
      (WORD) @local.reference)))

(move_statement
  (qualified_word
    (WORD) @local.reference))

(perform_statement_call_proc
  procedure: (perform_procedure
               (label
                 (qualified_word
                   (WORD) @local.reference))))

(display_statement
 (qualified_word
   (WORD) @local.reference))

(accept_statement
 (qualified_word
   (WORD) @local.reference))

(add_statement
  (qualified_word
          (WORD) @local.reference))

(multiply_statement
  (qualified_word
    (WORD) @local.reference))

(subtract_statement
  (qualified_word
    (WORD) @local.reference))

(allocate_statement
  x: (WORD) @local.reference)

(allocate_statement
  returning: (qualified_word
               (WORD) @local.reference))

(alter_statement
  (alter_option
    proc_name: (qualified_word
                 (WORD) @local.reference)))

(alter_statement
  (alter_option
    to: (qualified_word
                 (WORD) @local.reference)))

(call_statement
  x: (qualified_word 
       (WORD) @local.reference))

;; todo GIVING FOO returns
(call_statement
  returning: (qualified_word 
       (WORD) @local.reference))

(call_param_arg
  (qualified_word 
    (WORD) @local.reference))

(cancel_statement
  (qualified_word 
    (WORD) @local.reference))

(close_statement
  (close_arg
    (WORD) @local.reference))

(delete_statement
  file_name: (_) @local.reference)

(divide_statement
  x: (qualified_word
       (WORD) @local.reference))

(goto_statement
  to: (label
        (qualified_word
          (WORD) @local.reference)))

(initialize_statement
  (qualified_word
    (WORD) @local.reference))

(inspect_statement
  send: (qualified_word
          (WORD) @local.reference))

(inspect_converting
  (qualified_word
    (WORD) @local.reference))

(inspect_tallying
  (qualified_word
    (WORD) @local.reference))

(inspect_replacing
  (replacing_item
    (replacing_region
      (qualified_word
        (WORD) @local.reference))))

(merge_statement
  x: (qualified_word 
       (WORD) @local.reference))

(merge_statement
  collating: (qualified_word 
       (WORD) @local.reference))

(merge_statement
  output: (sort_output_giving
            (WORD) @local.reference))

(merge_statement
  output: (sort_output_procedure
            (perform_procedure
              (label
                (qualified_word
                  (WORD) @local.reference)))))

(start_statement
  file_name: (WORD) @local.reference)

(sort_key
  key_list: (qualified_word 
              (WORD) @local.reference))

; todo call this key list
(start_key
  keys: (qualified_word 
              (WORD) @local.reference))

(stop_statement
  (qualified_word
    (WORD) @local.reference))

(string_statement
  (qualified_word
    (WORD) @local.reference))

(unstring_statement
  (qualified_word
    (WORD) @local.reference))

(string_statement
  (string_item
    (qualified_word
     (WORD) @local.reference)))

(unstring_statement
  (unstring_delimited
    (unstring_delimited_item
      (qualified_word
        (WORD) @local.reference))))

(unstring_statement
  (unstring_into_item
    (qualified_word
      (WORD) @local.reference)))

(use_statement
  (WORD) @local.reference)

(use_statement
  (qualified_word
    (WORD) @local.reference))

(write_statement
  (qualified_word
    (WORD) @local.reference))

(use_statement
  (label
    (qualified_word
      (WORD) @local.reference)))

(open_statement
  (open_arg
    (WORD) @local.reference))

(expr
  (qualified_word
    (WORD) @local.reference))

(arithmetic_x
  (qualified_word
    (WORD) @local.reference))


