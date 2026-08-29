--
-- PostgreSQL database dump
--

\restrict STNlylIfxYt9gVtLDBBELcu8z2Xax122cS94hKyIW9vXRCeFtUO7CL169BArzRq

-- Dumped from database version 16.13 (Debian 16.13-1.pgdg13+1)
-- Dumped by pg_dump version 16.13 (Debian 16.13-1.pgdg13+1)

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

ALTER TABLE IF EXISTS ONLY public.volumes DROP CONSTRAINT IF EXISTS volumes_novel_id_fkey;
ALTER TABLE IF EXISTS ONLY public.tags DROP CONSTRAINT IF EXISTS tags_novel_id_fkey;
ALTER TABLE IF EXISTS ONLY public.characters DROP CONSTRAINT IF EXISTS fk_characters_role_id;
ALTER TABLE IF EXISTS ONLY public.events DROP CONSTRAINT IF EXISTS events_novel_id_fkey;
ALTER TABLE IF EXISTS ONLY public.events DROP CONSTRAINT IF EXISTS events_chapter_id_fkey;
ALTER TABLE IF EXISTS ONLY public.event_characters DROP CONSTRAINT IF EXISTS event_characters_event_id_fkey;
ALTER TABLE IF EXISTS ONLY public.event_characters DROP CONSTRAINT IF EXISTS event_characters_character_id_fkey;
ALTER TABLE IF EXISTS ONLY public.characters DROP CONSTRAINT IF EXISTS characters_novel_id_fkey;
ALTER TABLE IF EXISTS ONLY public.characters DROP CONSTRAINT IF EXISTS characters_first_appearance_chapter_id_fkey;
ALTER TABLE IF EXISTS ONLY public.chapters DROP CONSTRAINT IF EXISTS chapters_volume_id_fkey;
ALTER TABLE IF EXISTS ONLY public.chapter_tags DROP CONSTRAINT IF EXISTS chapter_tags_tag_id_fkey;
ALTER TABLE IF EXISTS ONLY public.chapter_tags DROP CONSTRAINT IF EXISTS chapter_tags_chapter_id_fkey;
ALTER TABLE IF EXISTS ONLY public.chapter_characters DROP CONSTRAINT IF EXISTS chapter_characters_character_id_fkey;
ALTER TABLE IF EXISTS ONLY public.chapter_characters DROP CONSTRAINT IF EXISTS chapter_characters_chapter_id_fkey;
DROP INDEX IF EXISTS public.idx_volumes_novel_id;
DROP INDEX IF EXISTS public.idx_tags_novel_id;
DROP INDEX IF EXISTS public.idx_events_novel_id;
DROP INDEX IF EXISTS public.idx_event_characters_character_id;
DROP INDEX IF EXISTS public.idx_characters_search_vector;
DROP INDEX IF EXISTS public.idx_characters_role_id;
DROP INDEX IF EXISTS public.idx_characters_novel_id;
DROP INDEX IF EXISTS public.idx_chapters_volume_id;
DROP INDEX IF EXISTS public.idx_chapters_search_vector;
DROP INDEX IF EXISTS public.idx_chapter_tags_tag_id;
DROP INDEX IF EXISTS public.idx_chapter_characters_character_id;
ALTER TABLE IF EXISTS ONLY public.volumes DROP CONSTRAINT IF EXISTS volumes_pkey;
ALTER TABLE IF EXISTS ONLY public.volumes DROP CONSTRAINT IF EXISTS volumes_novel_id_number_key;
ALTER TABLE IF EXISTS ONLY public.tags DROP CONSTRAINT IF EXISTS tags_pkey;
ALTER TABLE IF EXISTS ONLY public.tags DROP CONSTRAINT IF EXISTS tags_novel_id_name_key;
ALTER TABLE IF EXISTS ONLY public.schema_migrations DROP CONSTRAINT IF EXISTS schema_migrations_pkey;
ALTER TABLE IF EXISTS ONLY public.novels DROP CONSTRAINT IF EXISTS novels_pkey;
ALTER TABLE IF EXISTS ONLY public.events DROP CONSTRAINT IF EXISTS events_pkey;
ALTER TABLE IF EXISTS ONLY public.event_characters DROP CONSTRAINT IF EXISTS event_characters_pkey;
ALTER TABLE IF EXISTS ONLY public.characters DROP CONSTRAINT IF EXISTS characters_pkey;
ALTER TABLE IF EXISTS ONLY public.characters DROP CONSTRAINT IF EXISTS characters_novel_id_name_key;
ALTER TABLE IF EXISTS ONLY public.character_roles DROP CONSTRAINT IF EXISTS character_roles_pkey;
ALTER TABLE IF EXISTS ONLY public.character_roles DROP CONSTRAINT IF EXISTS character_roles_code_key;
ALTER TABLE IF EXISTS ONLY public.chapters DROP CONSTRAINT IF EXISTS chapters_volume_id_number_key;
ALTER TABLE IF EXISTS ONLY public.chapters DROP CONSTRAINT IF EXISTS chapters_pkey;
ALTER TABLE IF EXISTS ONLY public.chapter_tags DROP CONSTRAINT IF EXISTS chapter_tags_pkey;
ALTER TABLE IF EXISTS ONLY public.chapter_characters DROP CONSTRAINT IF EXISTS chapter_characters_pkey;
DROP TABLE IF EXISTS public.volumes;
DROP TABLE IF EXISTS public.tags;
DROP TABLE IF EXISTS public.schema_migrations;
DROP TABLE IF EXISTS public.novels;
DROP TABLE IF EXISTS public.events;
DROP TABLE IF EXISTS public.event_characters;
DROP TABLE IF EXISTS public.characters;
DROP TABLE IF EXISTS public.character_roles;
DROP TABLE IF EXISTS public.chapters;
DROP TABLE IF EXISTS public.chapter_tags;
DROP TABLE IF EXISTS public.chapter_characters;
SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: chapter_characters; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.chapter_characters (
    chapter_id uuid NOT NULL,
    character_id uuid NOT NULL
);


--
-- Name: chapter_tags; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.chapter_tags (
    chapter_id uuid NOT NULL,
    tag_id uuid NOT NULL
);


--
-- Name: chapters; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.chapters (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    number integer NOT NULL,
    title text NOT NULL,
    summary text,
    read_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    search_vector tsvector GENERATED ALWAYS AS (to_tsvector('simple'::regconfig, ((COALESCE(title, ''::text) || ' '::text) || COALESCE(summary, ''::text)))) STORED,
    volume_id uuid NOT NULL
);


--
-- Name: character_roles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.character_roles (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    code text NOT NULL,
    name text NOT NULL,
    description text DEFAULT ''::text NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: characters; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.characters (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    novel_id uuid NOT NULL,
    name text NOT NULL,
    aliases text[] DEFAULT '{}'::text[],
    description text,
    first_appearance_chapter_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    search_vector tsvector GENERATED ALWAYS AS (to_tsvector('simple'::regconfig, ((COALESCE(name, ''::text) || ' '::text) || COALESCE(description, ''::text)))) STORED,
    role_id uuid NOT NULL,
    profile_image_url text
);


--
-- Name: event_characters; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.event_characters (
    event_id uuid NOT NULL,
    character_id uuid NOT NULL
);


--
-- Name: events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.events (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    novel_id uuid NOT NULL,
    chapter_id uuid,
    title text NOT NULL,
    description text,
    story_date text NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: novels; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.novels (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    title text NOT NULL,
    author text,
    status text DEFAULT 'reading'::text NOT NULL,
    description text,
    cover_url text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: schema_migrations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.schema_migrations (
    version bigint NOT NULL,
    dirty boolean NOT NULL
);


--
-- Name: tags; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tags (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    novel_id uuid NOT NULL,
    name text NOT NULL
);


--
-- Name: volumes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.volumes (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    novel_id uuid NOT NULL,
    number integer NOT NULL,
    title text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Data for Name: chapter_characters; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.chapter_characters (chapter_id, character_id) FROM stdin;
d86c1e4f-4581-446d-b218-9c4b01df2f16	e7984f77-b94f-4e03-b114-9a047cedd9b8
\.


--
-- Data for Name: chapter_tags; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.chapter_tags (chapter_id, tag_id) FROM stdin;
\.


--
-- Data for Name: chapters; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.chapters (id, number, title, summary, read_at, created_at, updated_at, volume_id) FROM stdin;
d86c1e4f-4581-446d-b218-9c4b01df2f16	1	First Friend	[[Elara]] woke up and looked around.	2026-05-22 02:00:00+00	2026-05-20 08:09:31.728163+00	2026-05-27 17:13:22.689909+00	58c59f81-e2ed-4a14-9f34-ca7af10d940e
34202154-a600-4547-b499-c48aa010097d	2	Battle in the Goblin Village		\N	2026-05-26 17:18:01.829945+00	2026-05-27 17:13:22.689909+00	58c59f81-e2ed-4a14-9f34-ca7af10d940e
2dc1379e-3e0c-4b14-97c1-64199014c6d3	3	In the Dwarven Kingdom		\N	2026-05-27 16:46:29.516043+00	2026-05-27 17:13:22.689909+00	58c59f81-e2ed-4a14-9f34-ca7af10d940e
219c0c16-13bf-4985-9138-845375c13d25	4	The Conqueror of Flames		\N	2026-05-27 16:46:45.721535+00	2026-05-27 17:13:22.689909+00	58c59f81-e2ed-4a14-9f34-ca7af10d940e
\.


--
-- Data for Name: character_roles; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.character_roles (id, code, name, description, sort_order, is_active, created_at, updated_at) FROM stdin;
b6ea8ab3-f7a1-42a9-9059-948267ada32c	main	Main	Primary point-of-view or lead character	10	t	2026-05-31 19:17:53.909666+00	2026-05-31 19:17:53.909666+00
bd606b11-e348-4a23-9842-3cedb282dc9d	supporting	Supporting	Important supporting character	20	t	2026-05-31 19:17:53.909666+00	2026-05-31 19:17:53.909666+00
c49b6da3-7671-4bfa-8308-966f288f5567	minor	Minor	Minor or occasional character	30	t	2026-05-31 19:17:53.909666+00	2026-05-31 19:17:53.909666+00
56249b12-ebc0-465e-8b4b-9f26ab8e5845	antagonist	Antagonist	Primary opposing character	40	t	2026-05-31 19:17:53.909666+00	2026-05-31 19:17:53.909666+00
be1a9e7e-d9ce-4fd3-9035-d7a55b53fb51	protagonist	Protagonist	Imported from legacy character role	100	t	2026-05-31 19:17:53.909666+00	2026-05-31 19:17:53.909666+00
\.


--
-- Data for Name: characters; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.characters (id, novel_id, name, aliases, description, first_appearance_chapter_id, created_at, updated_at, role_id, profile_image_url) FROM stdin;
e7984f77-b94f-4e03-b114-9a047cedd9b8	0221279b-60f9-405d-8b36-6175e598bff4	Rimuru Tempest	{"Bestie (by Milim)",Boss,"Great Phantom Thief Satoru (during Visions of Coleus)","His/Your Majesty","Master (by Ranga)","Papa (By Shinsha)",Rimu,"Squishy (by Laplace)","Teacher/Sensei (by Class S)"}	Rimuru Tempest ｢リムル＝テンペスト, rimuru tenpesuto｣ is the main protagonist of That Time I Got Reincarnated as a Slime and the reincarnation of Satoru Mikami.	\N	2026-05-20 08:09:17.185621+00	2026-05-27 17:28:22.01879+00	be1a9e7e-d9ce-4fd3-9035-d7a55b53fb51	https://preview.redd.it/friendly-reminder-rimuru-is-not-as-innocent-endearing-as-v0-mxr2sfp44und1.jpeg?auto=webp&s=9538726216e0b0c5b8765980fc11faa35d9ba0e5
\.


--
-- Data for Name: event_characters; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.event_characters (event_id, character_id) FROM stdin;
\.


--
-- Data for Name: events; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.events (id, novel_id, chapter_id, title, description, story_date, sort_order, created_at, updated_at) FROM stdin;
5c73ce9a-1f5e-465c-ac6b-51ef5fcd4587	0221279b-60f9-405d-8b36-6175e598bff4	\N	A		Year 1101	1	2026-05-21 04:54:49.094671+00	2026-05-21 04:54:49.094671+00
9b2687cd-36ee-4518-98bb-d4f5f1d39f9a	0221279b-60f9-405d-8b36-6175e598bff4	d86c1e4f-4581-446d-b218-9c4b01df2f16	A	A	11245	1	2026-08-28 02:57:07.227148+00	2026-08-28 02:57:07.227148+00
\.


--
-- Data for Name: novels; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.novels (id, title, author, status, description, cover_url, created_at, updated_at) FROM stdin;
0221279b-60f9-405d-8b36-6175e598bff4	That Time I Got Reincarnated as a Slime	Fuse ｢伏瀬フセ｣	reading	Lonely thirty-seven-year-old Satoru Mikami is stuck in a dead-end job, unhappy with his mundane life, but after dying at the hands of a robber, they awaken to a fresh start in a fantasy realm... as a slime! As Rimuru acclimates to their new, goopy, existence, their exploits with the other monsters set off a chain of events that will change the world forever!	https://vignette.wikia.nocookie.net/vsbattles/images/2/29/Tensura_art.jpg/revision/latest/scale-to-width-down/398?cb=20200211174712	2026-05-20 08:09:17.167036+00	2026-05-20 08:09:17.167036+00
\.


--
-- Data for Name: schema_migrations; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.schema_migrations (version, dirty) FROM stdin;
13	f
\.


--
-- Data for Name: tags; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.tags (id, novel_id, name) FROM stdin;
f85e1e66-09a3-4e77-b446-d5caf6758ab6	0221279b-60f9-405d-8b36-6175e598bff4	Test
\.


--
-- Data for Name: volumes; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.volumes (id, novel_id, number, title, created_at, updated_at) FROM stdin;
58c59f81-e2ed-4a14-9f34-ca7af10d940e	0221279b-60f9-405d-8b36-6175e598bff4	1	Empowerment	2026-05-21 06:41:45.280431+00	2026-05-27 17:22:11.884218+00
0b9ad7e0-2f81-4df1-adb8-24a0a89ae9e4	0221279b-60f9-405d-8b36-6175e598bff4	2	A Disturbance in the Forest	2026-05-27 17:22:27.141396+00	2026-05-27 17:22:27.141396+00
6be207de-4c8d-446b-ba2e-8a4fe69f6a3f	0221279b-60f9-405d-8b36-6175e598bff4	3	Attack of the Demon Lord	2026-05-27 17:22:57.669434+00	2026-05-27 17:22:57.669434+00
800625cd-9e89-44b5-a4d5-a21825a585fa	0221279b-60f9-405d-8b36-6175e598bff4	4	Human-Monster Interaction	2026-05-27 17:23:43.001217+00	2026-05-27 17:23:43.001217+00
992cb8ce-391a-473f-8e45-348534a1768d	0221279b-60f9-405d-8b36-6175e598bff4	5	A Demon Lord's Awakening	2026-05-27 17:24:02.350064+00	2026-05-27 17:24:02.350064+00
96c8ddc2-013e-4ec5-a19c-c250df071ef2	0221279b-60f9-405d-8b36-6175e598bff4	6	The Octagram Soars	2026-05-27 17:30:15.20046+00	2026-05-27 17:30:15.20046+00
5a8b1379-3f3c-4329-aa80-6745545f276f	0221279b-60f9-405d-8b36-6175e598bff4	7	Conflict Between Saints and Monsters	2026-05-27 17:30:25.752742+00	2026-05-27 17:30:25.752742+00
74a49834-8730-4bff-b6a1-9ab0046da800	0221279b-60f9-405d-8b36-6175e598bff4	8	Territory Seizure	2026-05-27 17:30:52.132149+00	2026-05-27 17:30:52.132149+00
cb4843e1-ebec-473e-970f-90449f8eed3b	0221279b-60f9-405d-8b36-6175e598bff4	9	Opening of the Monster City	2026-05-27 17:31:32.890092+00	2026-05-27 17:31:32.890092+00
189b92a7-33f4-4b90-a3ec-f193a78bcef3	0221279b-60f9-405d-8b36-6175e598bff4	10	The Majin Behind the Scenes	2026-05-27 17:31:44.481412+00	2026-05-27 17:31:44.481412+00
e5ee6e53-bd32-4ca3-9df1-540bd1c5a0df	0221279b-60f9-405d-8b36-6175e598bff4	11	Awakening of the Chosen Hero	2026-05-27 17:31:53.34536+00	2026-05-27 17:31:53.34536+00
afd6ebad-ffc1-43ea-9652-86deb59d0912	0221279b-60f9-405d-8b36-6175e598bff4	12	The Eve of War	2026-05-27 17:32:46.433626+00	2026-05-27 17:32:46.433626+00
faa9642d-8cf6-465c-869e-e7f3106d7c72	0221279b-60f9-405d-8b36-6175e598bff4	13	The Imperial Invasion	2026-05-27 17:32:59.550214+00	2026-05-27 17:32:59.550214+00
cbe05e5d-d32f-42b6-9fb5-29a22455fa30	0221279b-60f9-405d-8b36-6175e598bff4	14	A Clash of Dragons and Monsters	2026-05-27 17:33:14.957976+00	2026-05-27 17:33:14.957976+00
08134cf3-9c65-4808-acee-193525d621a8	0221279b-60f9-405d-8b36-6175e598bff4	15	The Abyss Unleashed	2026-05-27 17:33:33.043287+00	2026-05-27 17:33:33.043287+00
7942831f-9ddf-4e7a-bf66-4fb5658d0453	0221279b-60f9-405d-8b36-6175e598bff4	16	End of the Game	2026-05-27 17:34:21.705783+00	2026-05-27 17:34:21.705783+00
5a3d8042-7cac-411b-bfd6-cac6ee4dc83b	0221279b-60f9-405d-8b36-6175e598bff4	17	Spacetime Fragments	2026-05-27 17:34:36.064941+00	2026-05-27 17:34:36.064941+00
8bd6681f-33b8-4720-b342-cc9f42f172f9	0221279b-60f9-405d-8b36-6175e598bff4	18	The End of Ambitions	2026-05-27 17:34:54.897415+00	2026-05-27 17:34:54.897415+00
09b411a8-1701-4094-a3f3-1e472e43a385	0221279b-60f9-405d-8b36-6175e598bff4	19	A Disturbance in the Royal Capital	2026-05-27 17:35:06.792037+00	2026-05-27 17:35:06.792037+00
d322de74-5c79-45ce-9fe3-cf456417908b	0221279b-60f9-405d-8b36-6175e598bff4	20	Rumbling of Heaven and Earth	2026-05-27 17:35:22.575621+00	2026-05-27 17:35:22.575621+00
89394376-8506-4684-9bac-28c63734ce26	0221279b-60f9-405d-8b36-6175e598bff4	21	Dungeon Encroachment	2026-05-27 17:36:05.818829+00	2026-05-27 17:36:05.818829+00
d0faab21-f1e3-41fc-b0a6-d05a067cfb15	0221279b-60f9-405d-8b36-6175e598bff4	22	Godly Destruction and Chaos	2026-05-27 17:37:10.097446+00	2026-05-27 17:37:10.097446+00
2a605055-6f69-4371-a62e-7c87780d1b08	0221279b-60f9-405d-8b36-6175e598bff4	23	Genesis of Rivalry	2026-05-27 17:38:31.095586+00	2026-05-27 17:38:31.095586+00
\.


--
-- Name: chapter_characters chapter_characters_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chapter_characters
    ADD CONSTRAINT chapter_characters_pkey PRIMARY KEY (chapter_id, character_id);


--
-- Name: chapter_tags chapter_tags_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chapter_tags
    ADD CONSTRAINT chapter_tags_pkey PRIMARY KEY (chapter_id, tag_id);


--
-- Name: chapters chapters_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chapters
    ADD CONSTRAINT chapters_pkey PRIMARY KEY (id);


--
-- Name: chapters chapters_volume_id_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chapters
    ADD CONSTRAINT chapters_volume_id_number_key UNIQUE (volume_id, number);


--
-- Name: character_roles character_roles_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.character_roles
    ADD CONSTRAINT character_roles_code_key UNIQUE (code);


--
-- Name: character_roles character_roles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.character_roles
    ADD CONSTRAINT character_roles_pkey PRIMARY KEY (id);


--
-- Name: characters characters_novel_id_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.characters
    ADD CONSTRAINT characters_novel_id_name_key UNIQUE (novel_id, name);


--
-- Name: characters characters_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.characters
    ADD CONSTRAINT characters_pkey PRIMARY KEY (id);


--
-- Name: event_characters event_characters_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.event_characters
    ADD CONSTRAINT event_characters_pkey PRIMARY KEY (event_id, character_id);


--
-- Name: events events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.events
    ADD CONSTRAINT events_pkey PRIMARY KEY (id);


--
-- Name: novels novels_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.novels
    ADD CONSTRAINT novels_pkey PRIMARY KEY (id);


--
-- Name: schema_migrations schema_migrations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.schema_migrations
    ADD CONSTRAINT schema_migrations_pkey PRIMARY KEY (version);


--
-- Name: tags tags_novel_id_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tags
    ADD CONSTRAINT tags_novel_id_name_key UNIQUE (novel_id, name);


--
-- Name: tags tags_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tags
    ADD CONSTRAINT tags_pkey PRIMARY KEY (id);


--
-- Name: volumes volumes_novel_id_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.volumes
    ADD CONSTRAINT volumes_novel_id_number_key UNIQUE (novel_id, number);


--
-- Name: volumes volumes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.volumes
    ADD CONSTRAINT volumes_pkey PRIMARY KEY (id);


--
-- Name: idx_chapter_characters_character_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_chapter_characters_character_id ON public.chapter_characters USING btree (character_id);


--
-- Name: idx_chapter_tags_tag_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_chapter_tags_tag_id ON public.chapter_tags USING btree (tag_id);


--
-- Name: idx_chapters_search_vector; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_chapters_search_vector ON public.chapters USING gin (search_vector);


--
-- Name: idx_chapters_volume_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_chapters_volume_id ON public.chapters USING btree (volume_id);


--
-- Name: idx_characters_novel_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_characters_novel_id ON public.characters USING btree (novel_id);


--
-- Name: idx_characters_role_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_characters_role_id ON public.characters USING btree (role_id);


--
-- Name: idx_characters_search_vector; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_characters_search_vector ON public.characters USING gin (search_vector);


--
-- Name: idx_event_characters_character_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_event_characters_character_id ON public.event_characters USING btree (character_id);


--
-- Name: idx_events_novel_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_events_novel_id ON public.events USING btree (novel_id);


--
-- Name: idx_tags_novel_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tags_novel_id ON public.tags USING btree (novel_id);


--
-- Name: idx_volumes_novel_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_volumes_novel_id ON public.volumes USING btree (novel_id);


--
-- Name: chapter_characters chapter_characters_chapter_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chapter_characters
    ADD CONSTRAINT chapter_characters_chapter_id_fkey FOREIGN KEY (chapter_id) REFERENCES public.chapters(id) ON DELETE CASCADE;


--
-- Name: chapter_characters chapter_characters_character_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chapter_characters
    ADD CONSTRAINT chapter_characters_character_id_fkey FOREIGN KEY (character_id) REFERENCES public.characters(id) ON DELETE CASCADE;


--
-- Name: chapter_tags chapter_tags_chapter_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chapter_tags
    ADD CONSTRAINT chapter_tags_chapter_id_fkey FOREIGN KEY (chapter_id) REFERENCES public.chapters(id) ON DELETE CASCADE;


--
-- Name: chapter_tags chapter_tags_tag_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chapter_tags
    ADD CONSTRAINT chapter_tags_tag_id_fkey FOREIGN KEY (tag_id) REFERENCES public.tags(id) ON DELETE CASCADE;


--
-- Name: chapters chapters_volume_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chapters
    ADD CONSTRAINT chapters_volume_id_fkey FOREIGN KEY (volume_id) REFERENCES public.volumes(id) ON DELETE CASCADE;


--
-- Name: characters characters_first_appearance_chapter_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.characters
    ADD CONSTRAINT characters_first_appearance_chapter_id_fkey FOREIGN KEY (first_appearance_chapter_id) REFERENCES public.chapters(id) ON DELETE SET NULL;


--
-- Name: characters characters_novel_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.characters
    ADD CONSTRAINT characters_novel_id_fkey FOREIGN KEY (novel_id) REFERENCES public.novels(id) ON DELETE CASCADE;


--
-- Name: event_characters event_characters_character_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.event_characters
    ADD CONSTRAINT event_characters_character_id_fkey FOREIGN KEY (character_id) REFERENCES public.characters(id) ON DELETE CASCADE;


--
-- Name: event_characters event_characters_event_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.event_characters
    ADD CONSTRAINT event_characters_event_id_fkey FOREIGN KEY (event_id) REFERENCES public.events(id) ON DELETE CASCADE;


--
-- Name: events events_chapter_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.events
    ADD CONSTRAINT events_chapter_id_fkey FOREIGN KEY (chapter_id) REFERENCES public.chapters(id) ON DELETE SET NULL;


--
-- Name: events events_novel_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.events
    ADD CONSTRAINT events_novel_id_fkey FOREIGN KEY (novel_id) REFERENCES public.novels(id) ON DELETE CASCADE;


--
-- Name: characters fk_characters_role_id; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.characters
    ADD CONSTRAINT fk_characters_role_id FOREIGN KEY (role_id) REFERENCES public.character_roles(id);


--
-- Name: tags tags_novel_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tags
    ADD CONSTRAINT tags_novel_id_fkey FOREIGN KEY (novel_id) REFERENCES public.novels(id) ON DELETE CASCADE;


--
-- Name: volumes volumes_novel_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.volumes
    ADD CONSTRAINT volumes_novel_id_fkey FOREIGN KEY (novel_id) REFERENCES public.novels(id) ON DELETE CASCADE;


--
-- PostgreSQL database dump complete
--

\unrestrict STNlylIfxYt9gVtLDBBELcu8z2Xax122cS94hKyIW9vXRCeFtUO7CL169BArzRq

