-- Reference data for local databases: the taxonomy rows production uses,
-- copied with `supabase db dump --data-only` on 2026-10-16. Loaded by
-- `supabase db reset` after the migrations. No user data belongs here.

INSERT INTO "public"."business_domains" ("id", "slug", "name", "description", "sort_order", "is_active", "created_at", "updated_at") VALUES
	('b24e319e-e79d-4ce5-8e10-bb6ae0db2407', 'health', 'Health', 'Clinics, dental offices, private practices, and similar businesses.', 1, true, '2026-05-07 09:55:28.394413+00', '2026-05-07 09:55:28.394413+00'),
	('d3c2e9da-c19c-49a0-821b-0f8d38e14f03', 'food-beverage', 'Food & Beverage', 'Restaurants, cafes, bakeries, and delivery-first brands.', 2, true, '2026-05-07 09:55:28.394413+00', '2026-05-07 09:55:28.394413+00'),
	('04357da8-b272-4bc2-9a53-23f80bfe3c36', 'real-estate', 'Real Estate', 'Agencies, brokers, rentals, and property-related businesses.', 3, true, '2026-05-07 09:55:28.394413+00', '2026-05-07 09:55:28.394413+00'),
	('99213c1a-ff09-4428-88ce-3b468c84b130', 'education', 'Education', 'Schools, courses, trainers, and tutoring businesses.', 4, true, '2026-05-07 09:55:28.394413+00', '2026-05-07 09:55:28.394413+00'),
	('6860b401-e9b2-4b90-bfc4-14264b971a9c', 'retail', 'Retail', 'Local shops, online stores, and product-based businesses.', 5, true, '2026-05-07 09:55:28.394413+00', '2026-05-07 09:55:28.394413+00'),
	('3afbb834-0e9e-4bd4-8361-06a80940865e', 'saas', 'SaaS', 'Software products, startups, and recurring-service platforms.', 6, true, '2026-05-07 09:55:28.394413+00', '2026-05-07 09:55:28.394413+00'),
	('b78ddff5-20a1-45d5-b29a-5ed4a89ff9b3', 'professional-services', 'Professional Services', 'Lawyers, accountants, consultants, and agencies.', 7, true, '2026-05-07 09:55:28.394413+00', '2026-05-07 09:55:28.394413+00'),
	('528d7f19-26d2-4e8a-ba29-bed5e543f953', 'hospitality', 'Hospitality', 'Hotels, apartments, travel, and tourism services.', 8, true, '2026-05-07 09:55:28.394413+00', '2026-05-07 09:55:28.394413+00');

INSERT INTO "public"."feature_tags" ("id", "slug", "name", "description", "sort_order", "is_active", "created_at", "updated_at") VALUES
	('f134af1a-99b7-4dc9-b9de-d05085fbde2f', 'contact-form', 'Contact form', 'Basic inquiry or lead form.', 1, true, '2026-05-07 09:55:28.394413+00', '2026-05-07 09:55:28.394413+00'),
	('73716f86-58ff-4588-a589-85a63fbdda4d', 'cms', 'CMS', 'Content editing for pages, posts, or offers.', 2, true, '2026-05-07 09:55:28.394413+00', '2026-05-07 09:55:28.394413+00'),
	('e83dbc1b-0129-42a6-82a0-c55c53f6ad11', 'booking', 'Booking', 'Appointment, reservation, or scheduling flow.', 3, true, '2026-05-07 09:55:28.394413+00', '2026-05-07 09:55:28.394413+00'),
	('300a6fae-3d3b-4cc3-9ed7-f138c35a0045', 'payments', 'Payments', 'Checkout, invoicing, or online payment collection.', 4, true, '2026-05-07 09:55:28.394413+00', '2026-05-07 09:55:28.394413+00'),
	('673a79f6-285e-4b67-863e-1daad7308714', 'dashboard', 'Dashboard', 'Authenticated dashboard with private data.', 5, true, '2026-05-07 09:55:28.394413+00', '2026-05-07 09:55:28.394413+00'),
	('8ae875ee-9a08-4e81-af1b-b172e46f31ad', 'auth', 'User accounts', 'Sign up, sign in, and account management.', 6, true, '2026-05-07 09:55:28.394413+00', '2026-05-07 09:55:28.394413+00'),
	('1fc79509-f427-4a28-82ab-6144d77167a8', 'multilingual', 'Multilingual', 'Multiple languages or locale-aware content.', 7, true, '2026-05-07 09:55:28.394413+00', '2026-05-07 09:55:28.394413+00'),
	('dc162f17-55f6-427b-9f52-76eedb2bae25', 'seo', 'SEO', 'Search visibility and metadata requirements.', 8, true, '2026-05-07 09:55:28.394413+00', '2026-05-07 09:55:28.394413+00'),
	('83b0713f-9e54-497b-b158-f420cc4e4998', 'analytics', 'Analytics', 'Traffic or conversion tracking.', 9, true, '2026-05-07 09:55:28.394413+00', '2026-05-07 09:55:28.394413+00'),
	('a60790ee-0b58-4af9-9025-bbacac330b8e', 'integrations', 'Integrations', 'Third-party APIs, CRM, ERP, or other tools.', 10, true, '2026-05-07 09:55:28.394413+00', '2026-05-07 09:55:28.394413+00'),
	('6683d074-6ebc-4826-828e-10b6952f11af', 'admin-panel', 'Admin panel', 'Internal admin interface for managing content or users.', 11, true, '2026-05-07 09:55:28.394413+00', '2026-05-07 09:55:28.394413+00'),
	('6b889d8a-fd4b-4cb7-839a-f18ceb27c952', 'file-uploads', 'File uploads', 'Upload and manage media or documents.', 12, true, '2026-05-07 09:55:28.394413+00', '2026-05-07 09:55:28.394413+00');

INSERT INTO "public"."project_categories" ("id", "name", "slug") VALUES
	('3b641b9a-a7d1-44a3-b062-9d65dcbbe23f', 'Informational Website', 'informational-website'),
	('179c715a-24f8-4f4d-8eda-06c3930f7564', 'Business Website', 'business-website'),
	('72800623-5e6b-466b-b3cb-51e17fd58c5f', 'Landing Page', 'landing-page'),
	('2eb9756a-2145-4ac8-bd40-f4d5e2a4e0af', 'E-commerce', 'e-commerce'),
	('dde5e468-0cc4-4682-88eb-7f1725ffbd51', 'Booking Website', 'booking-website'),
	('18241feb-b514-4ca5-a768-ebf4060eaafc', 'Portfolio Website', 'portfolio-website'),
	('9ef438fe-d868-4878-9782-ba62eb25c14f', 'Redesign', 'redesign'),
	('b79adadc-8e5b-460a-b4e5-c3cd89679914', 'Maintenance / SEO', 'maintenance-seo'),
	('5201745d-fb34-4f7c-9108-6785672dbb39', 'Custom Web App', 'custom-web-app'),
	('00293e33-8129-4521-8f5f-e41e6f9df1e5', 'Presentation site', 'presentation'),
	('cccc670f-e9ba-4de5-90c6-00221c4a2009', 'Website', 'website'),
	('88778904-87a1-465b-a22a-0b5329fb62a8', 'Web application', 'web-app');

INSERT INTO "public"."project_goals" ("id", "slug", "name", "description", "sort_order", "is_active", "created_at", "updated_at") VALUES
	('1a080d1d-183a-4a25-895d-84784e237d1e', 'lead-generation', 'Lead generation', 'Generate inquiries, calls, or contact form submissions.', 1, true, '2026-05-07 09:55:28.394413+00', '2026-05-07 09:55:28.394413+00'),
	('201eb230-63ef-4f3b-9534-aa8e4b290301', 'online-sales', 'Online sales', 'Sell products or services directly online.', 2, true, '2026-05-07 09:55:28.394413+00', '2026-05-07 09:55:28.394413+00'),
	('20f6290f-bb13-49b1-acb1-4f07043b5563', 'booking', 'Booking', 'Allow visitors to schedule appointments or reservations.', 3, true, '2026-05-07 09:55:28.394413+00', '2026-05-07 09:55:28.394413+00'),
	('17fc5815-9e65-4995-bc42-ad7ac871fe56', 'brand-presence', 'Brand presence', 'Build credibility and present the business professionally.', 4, true, '2026-05-07 09:55:28.394413+00', '2026-05-07 09:55:28.394413+00'),
	('9ee92bba-d1d5-4d25-b8dd-47c920328d58', 'internal-operations', 'Internal operations', 'Support internal workflows, dashboards, or admin tools.', 5, true, '2026-05-07 09:55:28.394413+00', '2026-05-07 09:55:28.394413+00'),
	('29b0e8f0-bbd5-4e8e-a1d8-96d82ea61c8d', 'customer-support', 'Customer support', 'Help users track orders, submit requests, or get assistance.', 6, true, '2026-05-07 09:55:28.394413+00', '2026-05-07 09:55:28.394413+00');

INSERT INTO "public"."service_types" ("id", "slug", "name", "description", "sort_order", "is_active", "created_at", "updated_at", "category_id") VALUES
	('15baf578-1e34-40b0-b237-2adb10f755f7', 'presentation', 'Presentation site', 'Simple business presentation or landing page.', 1, true, '2026-05-07 09:55:28.394413+00', '2026-05-07 09:55:28.394413+00', NULL),
	('11098197-1bae-4244-a576-f08b64a01da0', 'website', 'Website', 'Multi-page website for marketing, information, or lead generation.', 2, true, '2026-05-07 09:55:28.394413+00', '2026-05-07 09:55:28.394413+00', NULL),
	('9bd47687-3845-4e41-ac98-c83fb52f30ed', 'web-app', 'Web application', 'Interactive product, portal, dashboard, or internal tool.', 3, true, '2026-05-07 09:55:28.394413+00', '2026-05-07 09:55:28.394413+00', NULL);
