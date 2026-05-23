--
-- PostgreSQL database dump
--

\restrict okCDOH62hfEOh3Md6UDSfoqL8P8qg6BRmgDBl3OTp8XLc0afc0QilIPnR3IgcHl

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
    read_at date,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    search_vector tsvector GENERATED ALWAYS AS (to_tsvector('simple'::regconfig, ((COALESCE(title, ''::text) || ' '::text) || COALESCE(summary, ''::text)))) STORED,
    volume_id uuid NOT NULL
);


--
-- Name: characters; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.characters (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    novel_id uuid NOT NULL,
    name text NOT NULL,
    aliases text[] DEFAULT '{}'::text[],
    role text DEFAULT 'minor'::text NOT NULL,
    description text,
    first_appearance_chapter_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    search_vector tsvector GENERATED ALWAYS AS (to_tsvector('simple'::regconfig, ((COALESCE(name, ''::text) || ' '::text) || COALESCE(description, ''::text)))) STORED
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
d86c1e4f-4581-446d-b218-9c4b01df2f16	f85e1e66-09a3-4e77-b446-d5caf6758ab6
\.


--
-- Data for Name: chapters; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.chapters (id, number, title, summary, read_at, created_at, updated_at, volume_id) FROM stdin;
d86c1e4f-4581-446d-b218-9c4b01df2f16	1	The Beginning	[[Elara]] woke up and looked around.	2026-05-22	2026-05-20 08:09:31.728163+00	2026-05-21 04:52:39.170851+00	58c59f81-e2ed-4a14-9f34-ca7af10d940e
5628a55a-1235-4961-99c5-9b2bddc8989c	2	Ch 2	AAA	2026-05-22	2026-05-21 17:36:38.995694+00	2026-05-21 17:36:38.995694+00	58c59f81-e2ed-4a14-9f34-ca7af10d940e
\.


--
-- Data for Name: characters; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.characters (id, novel_id, name, aliases, role, description, first_appearance_chapter_id, created_at, updated_at) FROM stdin;
e7984f77-b94f-4e03-b114-9a047cedd9b8	0221279b-60f9-405d-8b36-6175e598bff4	Elara	{}	protagonist	Main hero	\N	2026-05-20 08:09:17.185621+00	2026-05-20 08:09:17.185621+00
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
\.


--
-- Data for Name: novels; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.novels (id, title, author, status, description, cover_url, created_at, updated_at) FROM stdin;
0221279b-60f9-405d-8b36-6175e598bff4	Test Novel	Test Author	reading	Description...		2026-05-20 08:09:17.167036+00	2026-05-20 08:09:17.167036+00
\.


--
-- Data for Name: schema_migrations; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.schema_migrations (version, dirty) FROM stdin;
11	f
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
58c59f81-e2ed-4a14-9f34-ca7af10d940e	0221279b-60f9-405d-8b36-6175e598bff4	1	Volume 1	2026-05-21 06:41:45.280431+00	2026-05-21 06:41:45.280431+00
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

\unrestrict okCDOH62hfEOh3Md6UDSfoqL8P8qg6BRmgDBl3OTp8XLc0afc0QilIPnR3IgcHl

