-- Replace the web-only client solution types with industry-wide services.
--
-- client_profiles.interested_solution_types offered only digital work (web
-- presentation, business website, web application, ...). The app now offers
-- broad categories for every industry, so map existing rows onto them;
-- otherwise those profiles would fail validation when edited. Several old keys
-- map to the same category, so each row keeps one copy of it. "other" and its
-- interested_solution_other_text are unchanged.

update public.client_profiles cp
set interested_solution_types = coalesce(
  (
    select array_agg(distinct coalesce(mapping.new_key, old.key))
    from unnest(cp.interested_solution_types) as old(key)
    left join (
      values
        ('web_presentation', 'tech_it'),
        ('business_website', 'tech_it'),
        ('ecommerce_store', 'tech_it'),
        ('web_application', 'tech_it'),
        ('booking_platform', 'tech_it'),
        ('portfolio', 'design_creative'),
        ('Web_design', 'design_creative'),
        ('Video_Editing', 'photo_video'),
        ('Digital_Markteing', 'marketing_sales')
    ) as mapping(old_key, new_key) on mapping.old_key = old.key
  ),
  '{}'::text[]
)
where cp.interested_solution_types && array[
  'web_presentation',
  'business_website',
  'ecommerce_store',
  'web_application',
  'booking_platform',
  'portfolio',
  'Web_design',
  'Video_Editing',
  'Digital_Markteing'
];
