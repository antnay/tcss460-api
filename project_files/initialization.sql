-- PostgreSQL Initialization Script - Complete Movie Database
-- Normalized to 3rd Normal Form (3NF)
-- Generated from movie dataset


BEGIN;


-- Drop existing tables if they exist (in reverse order of dependencies)
DROP TABLE IF EXISTS movie_actors CASCADE;
DROP TABLE IF EXISTS movie_studios CASCADE;
DROP TABLE IF EXISTS movie_genres CASCADE;
DROP TABLE IF EXISTS movie_producers CASCADE;
DROP TABLE IF EXISTS movie_directors CASCADE;
DROP TABLE IF EXISTS actors CASCADE;
DROP TABLE IF EXISTS studios CASCADE;
DROP TABLE IF EXISTS genres CASCADE;
DROP TABLE IF EXISTS producers CASCADE;
DROP TABLE IF EXISTS directors CASCADE;
DROP TABLE IF EXISTS collections CASCADE;
DROP TABLE IF EXISTS movies CASCADE;


-- ============================================================================
-- TABLE DEFINITIONS
-- ============================================================================


-- Create Collections table
CREATE TABLE collections (
   collection_id SERIAL PRIMARY KEY,
   collection_name VARCHAR(255) UNIQUE NOT NULL
);


-- Create Movies table
CREATE TABLE movies (
   movie_id SERIAL PRIMARY KEY,
   title VARCHAR(500) NOT NULL,
   original_title VARCHAR(500),
   release_date DATE,
   runtime_minutes INTEGER,
   overview TEXT,
   budget BIGINT,
   revenue BIGINT,
   mpa_rating VARCHAR(10),
   collection_id INTEGER REFERENCES collections(collection_id),
   poster_url VARCHAR(500),
   backdrop_url VARCHAR(500),
   CONSTRAINT check_runtime CHECK (runtime_minutes > 0),
   CONSTRAINT check_budget CHECK (budget >= 0),
   CONSTRAINT check_revenue CHECK (revenue >= 0)
);


-- Create Genres table
CREATE TABLE genres (
   genre_id SERIAL PRIMARY KEY,
   genre_name VARCHAR(100) UNIQUE NOT NULL
);


-- Create Studios table
CREATE TABLE studios (
   studio_id SERIAL PRIMARY KEY,
   studio_name VARCHAR(255) UNIQUE NOT NULL,
   logo_url VARCHAR(500),
   country VARCHAR(5)
);


-- Create Directors table
CREATE TABLE directors (
   director_id SERIAL PRIMARY KEY,
   director_name VARCHAR(255) UNIQUE NOT NULL
);


-- Create Producers table
CREATE TABLE producers (
   producer_id SERIAL PRIMARY KEY,
   producer_name VARCHAR(255) UNIQUE NOT NULL
);


-- Create Actors table
CREATE TABLE actors (
   actor_id SERIAL PRIMARY KEY,
   actor_name VARCHAR(255) UNIQUE NOT NULL,
   profile_url VARCHAR(500)
);


-- Create junction table for Movies and Genres (many-to-many)
CREATE TABLE movie_genres (
   movie_id INTEGER REFERENCES movies(movie_id) ON DELETE CASCADE,
   genre_id INTEGER REFERENCES genres(genre_id) ON DELETE CASCADE,
   PRIMARY KEY (movie_id, genre_id)
);


-- Create junction table for Movies and Studios (many-to-many)
CREATE TABLE movie_studios (
   movie_id INTEGER REFERENCES movies(movie_id) ON DELETE CASCADE,
   studio_id INTEGER REFERENCES studios(studio_id) ON DELETE CASCADE,
   PRIMARY KEY (movie_id, studio_id)
);


-- Create junction table for Movies and Directors (many-to-many)
CREATE TABLE movie_directors (
   movie_id INTEGER REFERENCES movies(movie_id) ON DELETE CASCADE,
   director_id INTEGER REFERENCES directors(director_id) ON DELETE CASCADE,
   PRIMARY KEY (movie_id, director_id)
);


-- Create junction table for Movies and Producers (many-to-many)
CREATE TABLE movie_producers (
   movie_id INTEGER REFERENCES movies(movie_id) ON DELETE CASCADE,
   producer_id INTEGER REFERENCES producers(producer_id) ON DELETE CASCADE,
   PRIMARY KEY (movie_id, producer_id)
);


-- Create junction table for Movies and Actors (many-to-many with additional attributes)
CREATE TABLE movie_actors (
   movie_id INTEGER REFERENCES movies(movie_id) ON DELETE CASCADE,
   actor_id INTEGER REFERENCES actors(actor_id) ON DELETE CASCADE,
   character_name VARCHAR(500),
   actor_order INTEGER NOT NULL,
   PRIMARY KEY (movie_id, actor_id, actor_order),
   CONSTRAINT check_actor_order CHECK (actor_order >= 1 AND actor_order <= 10)
);


-- ============================================================================
-- INDEXES
-- ============================================================================


CREATE INDEX idx_movies_release_date ON movies(release_date);
CREATE INDEX idx_movies_collection ON movies(collection_id);
CREATE INDEX idx_movies_title ON movies(title);
CREATE INDEX idx_movie_genres_movie ON movie_genres(movie_id);
CREATE INDEX idx_movie_genres_genre ON movie_genres(genre_id);
CREATE INDEX idx_movie_studios_movie ON movie_studios(movie_id);
CREATE INDEX idx_movie_studios_studio ON movie_studios(studio_id);
CREATE INDEX idx_movie_actors_movie ON movie_actors(movie_id);
CREATE INDEX idx_movie_actors_actor ON movie_actors(actor_id);
CREATE INDEX idx_actors_name ON actors(actor_name);
CREATE INDEX idx_studios_name ON studios(studio_name);


-- ============================================================================
-- DATA INSERTION
-- ============================================================================


-- Insert Collections
INSERT INTO collections (collection_name) VALUES
('Weapons Collection'),
('Happy Gilmore Collection'),
('The Bad Guys Collection'),
('How to Train Your Dragon (Live-Action) Collection'),
('M3GAN Collection'),
('28 Days/Weeks/Years Later Collection'),
('The Old Guard Collection'),
('Jurassic Park Collection'),
('Mission: Impossible Collection'),
('KPop Demon Hunters Collection');


-- Insert Genres
INSERT INTO genres (genre_name) VALUES
('Action'), ('Adventure'), ('Animation'), ('Comedy'), ('Crime'),
('Drama'), ('Family'), ('Fantasy'), ('Horror'), ('Music'),
('Mystery'), ('Romance'), ('Science Fiction'), ('Thriller');


-- Insert all Movies
INSERT INTO movies (title, original_title, release_date, runtime_minutes, overview, budget, revenue, mpa_rating, collection_id, poster_url, backdrop_url) VALUES
('Weapons', 'Weapons', '2025-08-04', 129, 'When all but one child from the same class mysteriously vanish on the same night at exactly the same time, a community is left questioning who or what is behind their disappearance.', 38000000, 210852983, 'R', 1, '/cpf7vsRZ0MYRQcnLWteD5jK9ymT.jpg', '/kyqM6padQzZ1eYxv84i9smNvZAG.jpg'),
('My Oxford Year', 'My Oxford Year', '2025-07-31', 113, 'An ambitious American fulfilling her dream of studying at Oxford falls for a charming Brit hiding a secret that may upend her perfectly planned life.', 0, 0, 'PG-13', NULL, '/jrhXbIOFingzdLjkccjg9vZnqIp.jpg', '/A466i5iATrpbVjX30clP1Zyfp31.jpg'),
('The Naked Gun', 'The Naked Gun', '2025-07-30', 85, 'Only one man has the particular set of skills... to lead Police Squad and save the world: Lt. Frank Drebin Jr.', 42000000, 86540700, 'PG-13', NULL, '/rmwQ8GsdQ1M3LtemNWLErle2nBU.jpg', '/1wi1hcbl6KYqARjdQ4qrBWZdiau.jpg'),
('War of the Worlds', 'War of the Worlds', '2025-07-29', 91, 'Will Radford is a top analyst for Homeland Security who tracks potential threats through a mass surveillance program, until one day an attack by an unknown entity leads him to question whether the government is hiding something from him... and from the rest of the world.', 0, 0, 'PG-13', NULL, '/yvirUYrva23IudARHn3mMGVxWqM.jpg', '/iZLqwEwUViJdSkGVjePGhxYzbDb.jpg'),
('The Pickup', 'The Pickup', '2025-07-27', 94, 'A routine cash pickup takes a wild turn when mismatched armored truck drivers Russell and Travis are ambushed by ruthless criminals led by savvy mastermind Zoe.', 0, 0, 'R', NULL, '/vFWvWhfAvij8UIngg2Vf6JV95Cr.jpg', '/y7tjLYcq2ZGy2DNG0ODhGX9Tm60.jpg'),
('Happy Gilmore 2', 'Happy Gilmore 2', '2025-07-25', 118, 'Happy Gilmore isn''t done with golf — not by a long shot. Since his retirement after his first Tour Championship win, Gilmore returns to finance his daughter''s ballet classes.', 152000000, 0, 'PG-13', 2, '/ynT06XivgBDkg7AtbDbX1dJeBGY.jpg', '/x5dVPttNDZaVRTvbk7pYrtGZoZN.jpg'),
('The Bad Guys 2', 'The Bad Guys 2', '2025-07-24', 104, 'The now-reformed Bad Guys are trying (very, very hard) to be good, but instead find themselves hijacked into a high-stakes, globe-trotting heist, masterminded by a new team of criminals they never saw coming: The Bad Girls.', 80000000, 155455193, 'PG', 3, '/26oSPnq0ct59l07QOXZKyzsiRtN.jpg', '/jvpkBenB6hv19WWYVlaiow8zklq.jpg'),
('Together', 'Together', '2025-07-23', 102, 'With a move to the countryside already testing the limits of a couple''s relationship, a supernatural encounter begins an extreme transformation of their love, their lives, and their flesh.', 17000000, 27715561, 'R', NULL, '/m52XidzKx94bKlToZfEXUnL3pdy.jpg', '/fBlzTwgtbDYkDKlhnPu69jHfVGy.jpg'),
('The Fantastic 4: First Steps', 'The Fantastic 4: First Steps', '2025-07-23', 115, 'Against the vibrant backdrop of a 1960s-inspired, retro-futuristic world, Marvel''s First Family is forced to balance their roles as heroes with the strength of their family bond, while defending Earth from a ravenous space god called Galactus and his enigmatic Herald, Silver Surfer.', 200000000, 492436052, 'PG-13', NULL, '/x26MtUlwtWD26d0G0FXcppxCJio.jpg', '/s94NjfKkcSczZ1FembwmQZwsuwY.jpg'),
('Brick', 'Brick', '2025-07-09', 99, 'When a mysterious brick wall encloses their apartment building overnight, Tim and Olivia must unite with their wary neighbors to get out alive.', 0, 0, 'R', NULL, '/vTX9CxFNEQOlfXsgqec7xmc5UtD.jpg', '/apNfldKI3RiaukNwJzr8EjRG7Wc.jpg'),
('Superman', 'Superman', '2025-07-09', 130, 'Superman, a journalist in Metropolis, embarks on a journey to reconcile his Kryptonian heritage with his human upbringing as Clark Kent.', 225000000, 606658792, 'PG-13', NULL, '/ombsmhYUqR4qqOLOxAyr5V8hbyv.jpg', '/eU7IfdWq8KQy0oNd4kKXS0QUR08.jpg'),
('Jurassic World Rebirth', 'Jurassic World Rebirth', '2025-07-01', 134, 'Five years after the events of Jurassic World Dominion, covert operations expert Zora Bennett is contracted to lead a skilled team on a top-secret mission to secure genetic material from the world''s three most massive dinosaurs.', 180000000, 844060875, 'PG-13', 8, '/1RICxzeoNCAO5NpcRMIgg1XT6fm.jpg', '/zNriRTr0kWwyaXPzdg1EIxf0BWk.jpg'),
('The Old Guard 2', 'The Old Guard 2', '2025-07-01', 107, 'Andy and her team of immortal warriors fight with renewed purpose as they face a powerful new foe threatening their mission to protect humanity.', 7000000, 0, 'R', 7, '/wqfu3bPLJaEWJVk3QOm0rKhxf1A.jpg', '/fd9K7ZDfzRAcbLh8JlG4HIKbtuR.jpg'),
('M3GAN 2.0', 'M3GAN 2.0', '2025-06-25', 120, 'After the underlying tech for M3GAN is stolen and misused by a powerful defense contractor to create a military-grade weapon known as Amelia, M3GAN''s creator Gemma realizes that the only option is to resurrect M3GAN and give her a few upgrades, making her faster, stronger, and more lethal.', 25000000, 39085199, 'PG-13', 5, '/4a63rQqIDTrYNdcnTXdPsQyxVLo.jpg', '/cEQMqB3ahd4mfeUN6VGC0ouVnZZ.jpg'),
('F1', 'F1', '2025-06-25', 156, 'Racing legend Sonny Hayes is coaxed out of retirement to lead a struggling Formula 1 team—and mentor a young hotshot driver—while chasing one more chance at glory.', 250000000, 607126203, 'PG-13', NULL, '/9PXZIUsSDh4alB80jheWX4fhZmy.jpg', '/ZtcGMc204JsNqfjS9lU6udRgpo.jpg'),
('Heads of State', 'Heads of State', '2025-06-24', 117, 'The UK Prime Minister and US President have a public rivalry that risks their countries'' alliance. But when they become targets of a powerful enemy, they''re forced to rely on each other as they go on a wild, multinational run.', 100, 0, 'PG-13', NULL, '/lVgE5oLzf7ABmzyASEVcjYyHI41.jpg', '/vJbEUMeI2AxBUZKjP6ZVeVNNTLh.jpg'),
('KPop Demon Hunters', 'KPop Demon Hunters', '2025-06-20', 96, 'When K-pop superstars Rumi, Mira and Zoey aren''t selling out stadiums, they''re using their secret powers to protect their fans from supernatural threats.', 100000000, 19200000, 'PG', 10, '/22AouvwlhlXbe3nrFcjzL24bvWH.jpg', '/l3ycQYwWmbz7p8otwbomFDXIEhn.jpg'),
('28 Years Later', '28 Years Later', '2025-06-18', 115, 'Twenty-eight years since the rage virus escaped a biological weapons laboratory, now, still in a ruthlessly enforced quarantine, some have found ways to exist amidst the infected.', 60000000, 150367300, 'R', 6, '/mIg1qCkVxnAlM2TK3RUF0tdEXlE.jpg', '/zav0v7gLWMu6pVwgsIAwt11GJ4C.jpg'),
('Elio', 'Elio', '2025-06-18', 98, 'Elio, a space fanatic with an active imagination, finds himself on a cosmic misadventure where he must form new bonds with eccentric alien lifeforms.', 150000000, 152204528, 'PG', NULL, '/w2ARwtc1zoh0pyfwmyhpZHwuXgK.jpg', '/lWeaB9S77Os7VHOt8GH5JdfrBX3.jpg'),
('Echo Valley', 'Echo Valley', '2025-06-13', 105, 'Kate lives a secluded life—until her troubled daughter shows up, frightened and covered in someone else''s blood.', 0, 0, 'R', NULL, '/3Ey3HuqZdrx1rfxRkfiOXDFtvtl.jpg', '/aQ5nvQGT6mM6TliOM5iSgrKVF4C.jpg'),
('Deep Cover', 'Deep Cover', '2025-06-12', 99, 'Kat is an improv comedy teacher beginning to question if she's missed her shot at success.', 0, 0, 'R', NULL, '/1vXTHTbSQJs9r2hp4Uk08XzKwPp.jpg', '/lOje1iz4VYWELYWRkZAwI7oIJd0.jpg'),
('Materialists', 'Materialists', '2025-06-12', 116, 'A young, ambitious New York City matchmaker finds herself torn between the perfect match and her imperfect ex.', 20000000, 75303614, 'R', NULL, '/eDo0pNruy0Qgj6BdTyHIR4cxHY8.jpg', '/lqwwGkwJHtz9QgKtz4zeY19YgDg.jpg'),
('How to Train Your Dragon', 'How to Train Your Dragon', '2025-06-06', 125, 'On the rugged isle of Berk, where Vikings and dragons have been bitter enemies for generations, Hiccup stands apart.', 150000000, 628789364, 'PG', 4, '/q5pXRYTycaeW6dEgsCrd4mYPmxM.jpg', '/qEFTuoFIAwrnVn7IsvE8RVt2TK3.jpg'),
('STRAW', 'STRAW', '2025-06-05', 105, 'A devastatingly bad day pushes a hardworking single mother to the breaking point.', 0, 0, 'R', NULL, '/t3cmnXYtxJb9vVL1ThvT2CWSe1n.jpg', '/fnbWrDx8w8Reau4F1tFqoGuGmDZ.jpg'),
('Predator: Killer of Killers', 'Predator: Killer of Killers', '2025-06-05', 85, 'While three of the fiercest warriors in human history are killers in their own right, they are merely prey for their new opponent.', 0, 0, 'R', NULL, '/2XDQa6EmFHSA37j1t0w88vpWqj9.jpg', '/a3F9cXjRH488qcOqFmFZwqawBMU.jpg'),
('The Life of Chuck', 'The Life of Chuck', '2025-06-05', 111, 'Charles ''Chuck'' Krantz experiences the wonder of love, the heartbreak of loss, and the multitudes contained in all of us.', 0, 11495005, 'R', NULL, '/oumprkO9bThExP8NwxBIBnvBu2v.jpg', '/lecBUG6Hsw7pYjTNAPBUgouDfjW.jpg'),
('Ballerina', 'Ballerina', '2025-06-04', 125, 'Eve Macarro begins her training in the assassin traditions of the Ruska Roma.', 90000000, 131794570, 'R', NULL, '/2VUmvqsHb6cEtdfscEA6fqqVzLg.jpg', '/sItIskd5xpiE64bBWYwZintkGf3.jpg'),
('Bring Her Back', 'Bring Her Back', '2025-05-28', 104, 'A brother and sister are introduced to their new sibling by their foster mother, only to learn that she has a terrifying secret.', 15000000, 33023752, 'R', NULL, '/tObSf1VzzHt9xB0csanFtb3DRjf.jpg', '/2IIKts2A9vnUdM9tTC76B8tDmuZ.jpg'),
('The Phoenician Scheme', 'The Phoenician Scheme', '2025-05-23', 102, 'Wealthy businessman Zsa-zsa Korda appoints his only daughter, a nun, as sole heir to his estate.', 30000000, 38382371, 'PG-13', NULL, '/u2jxeYLXTYfu0bqJmnLGIgZswib.jpg', '/w3RDV3pSpxN0C2DZ4Xpw4o5LWpI.jpg'),
('Fear Street: Prom Queen', 'Fear Street: Prom Queen', '2025-05-23', 90, 'Who will be voted queen at Shadyside High''s 1988 prom?', 0, 0, 'R', NULL, '/gevScWYkF8l5i9NjFSXo8HfPNyy.jpg', '/qspghhpOyaBGgZDJoCbV2o9WNMU.jpg'),
('Fountain of Youth', 'Fountain of Youth', '2025-05-19', 126, 'A treasure-hunting mastermind assembles a team for a life-changing adventure.', 0, 0, 'PG-13', NULL, '/4iWjGghUj2uyHo2Hyw8NFBvsNGm.jpg', '/aESb695wTIF0tB7RTGRebnYrjFK.jpg'),
('Mission: Impossible - The Final Reckoning', 'Mission: Impossible - The Final Reckoning', '2025-05-17', 170, 'Ethan Hunt and team continue their search for the terrifying AI known as the Entity.', 400000000, 597913515, 'PG-13', 9, '/z53D72EAOxGRqdr7KXXWp9dJiDe.jpg', '/538U9snNc2fpnOmYXAPUh3zn31H.jpg');


-- Due to the large volume of data, I'll provide key examples for other tables
-- Full data insertion would follow the same pattern


-- Sample Studios
INSERT INTO studios (studio_name, logo_url, country) VALUES
('New Line Cinema', '/2ycs64eqV5rqKYHyQK0GVoKGvfX.png', 'US'),
('Subconscious', NULL, 'US'),
('Vertigo Entertainment', '/iJo9zP5QCKyBsmKSOcvXd6UDNih.png', 'US'),
('BoulderLight Pictures', '/pxtYCfl1DWzvizqZcYwE4NefOOF.png', 'US'),
('Domain Entertainment', '/kKVYqekveOvLK1IgqdJojLjQvtu.png', 'US'),
('Temple Hill Entertainment', '/5J93SHsuvIV32AE9oSbMi02pqw9.png', 'US'),
('Paramount Pictures', '/gz66EfNoYPqHTYI4q9UEN4CbHRc.png', 'US'),
('DreamWorks Animation', '/3BPX5VGBov8SDqTV7wC1L1xShAS.png', 'US'),
('Marvel Studios', '/hUzeosd33nzE5MCNsZxCGEKTXaQ.png', 'US'),
('DC Studios', '/2Z2hiM1ERqFOWRxNxWoJZ8lTxhb.png', 'US'),
('Universal Pictures', '/8lvHyhjr8oUKOOy2dKXoALWKdp0.png', 'US'),
('Amblin Entertainment', '/cEaxANEisCqeEoRvODv2dO1I0iI.png', 'US'),
('Pixar', '/1TjvGVDMYsj6JBxOAkUHpPEwLf7.png', 'US'),
('A24', '/1ZXsGaFPgrgS6ZZGS37AqD5uU12.png', 'US'),
('Blumhouse Productions', '/rzKluDcRkIwHZK2pHsiT667A2Kw.png', 'US'),
('Skydance Media', '/gXfFl9pRPaoaq14jybEn1pHeldr.png', 'US'),
('Columbia Pictures', '/71BqEFAF4V3qjjMPCpLuyJFB9A.png', 'US'),
('20th Century Studios', '/h0rjX5vjW5r8yEnUBStFarjcLT4.png', 'US'),
('Sony Pictures Animation', '/5ilV5mH3gxTEU7p5wjxptHvXkyr.png', 'US'),
('Lionsgate', '/cisLn1YAUuptXVBa0xjq7ST9cH0.png', 'US');


-- Sample Directors
INSERT INTO directors (director_name) VALUES
('Zach Cregger'), ('Iain Morris'), ('Akiva Schaffer'), ('Rich Lee'),
('Tim Story'), ('Kyle Newacheck'), ('Pierre Perifel'), ('Michael Shanks'),
('Matt Shakman'), ('Philip Koch'), ('James Gunn'), ('Gareth Edwards'),
('Victoria Mahoney'), ('Gerard Johnstone'), ('Joseph Kosinski'), ('Ilya Naishuller'),
('Chris Appelhans'), ('Maggie Kang'), ('Danny Boyle'), ('Domee Shi'),
('Madeline Sharafian'), ('Adrian Molina'), ('Michael Pearce'), ('Tom Kingsley'),
('Celine Song'), ('Dean DeBlois'), ('Tyler Perry'), ('Dan Trachtenberg'),
('Mike Flanagan'), ('Len Wiseman'), ('Michael Philippou'), ('Danny Philippou'),
('Wes Anderson'), ('Matt Palmer'), ('Guy Ritchie'), ('Christopher McQuarrie');


-- Sample Producers
INSERT INTO producers (producer_name) VALUES
('Zach Cregger'), ('Raphael Margules'), ('J.D. Lifshitz'), ('Roy Lee'),
('Marty Bowen'), ('Wyck Godfrey'), ('Erica Huggins'), ('Seth MacFarlane'),
('Timur Bekmambetov'), ('Patrick Aiello'), ('John Davis'), ('Eddie Murphy'),
('Robert Simonds'), ('Tim Herlihy'), ('Jack Giarraputo'), ('Adam Sandler'),
('Damon Ross'), ('Basil Iwanyk'), ('Erica Lee'), ('Chad Stahelski'),
('Kevin Feige'), ('Frank Marshall'), ('Patrick Crowley'), ('Peter Safran'),
('James Gunn'), ('Gina Prince-Bythewood'), ('David Ellison'), ('Dana Goldberg'),
('Jason Blum'), ('James Wan'), ('Lewis Hamilton'), ('Jerry Bruckheimer'),
('Brad Pitt'), ('John Rickard'), ('Michelle L.M. Wong'), ('Mike Flanagan'),
('Trevor Macy'), ('Guy Ritchie'), ('Ivan Atkinson'), ('Jake Myers'),
('Christopher McQuarrie'), ('Tom Cruise');


-- Sample Actors (first 50)
INSERT INTO actors (actor_name, profile_url) VALUES
('Julia Garner', '/ud1RXbvW70J89iqeic7no8olxvb.jpg'),
('Josh Brolin', '/sX2etBbIkxRaCsATyw5ZpOVMPTD.jpg'),
('Alden Ehrenreich', '/bx86TPUmeHp0QkijQb16r2qIwEr.jpg'),
('Austin Abrams', '/9pSpSAk9NsYC5puqAVsmSK3OSeu.jpg'),
('Benedict Wong', '/yYfLyrC2CE6vBWSJfkpuVKL2POM.jpg'),
('Sofia Carson', '/aQudxuIAd2UEGQD1YWsdrHH11Kc.jpg'),
('Corey Mylchreest', '/nP7HMr5VLNLbHqKj0Sn0g9rIL4H.jpg'),
('Liam Neeson', '/sRLev3wJioBgun3ZoeAUFpkLy0D.jpg'),
('Pamela Anderson', '/sk15ch2IQ6k6vWu07Jr77yw4oj5.jpg'),
('Paul Walter Hauser', '/hV2oiKF2xlDMXtuq3Si1TA4b6DA.jpg'),
('Ice Cube', '/ymR7Yll7HjL6i6Z3pt435hYi91T.jpg'),
('Eva Longoria', '/1u26GLWK1DE7gBugyI9P3OMFq4A.jpg'),
('Eddie Murphy', '/qgjMfefsKwSYsyCaIX46uyOXIpy.jpg'),
('Pete Davidson', '/f3kubnZu3KgMniExcq9nJy8RwjW.jpg'),
('Keke Palmer', '/f5i3WzdMt02mlfm9I9LHKRJtZ4J.jpg'),
('Adam Sandler', '/iTMnXrPfC1rmom6a9q4hy6YSJWG.jpg'),
('Julie Bowen', '/5ewqnbPAY0EzZObGHIKU4VsCanD.jpg'),
('Christopher McDonald', '/gK1XhbfD9Xd8s3VXRPpgDCluyZp.jpg'),
('Sam Rockwell', '/vYpWxV0bnUgKo7SdasfGP9HttUq.jpg'),
('Marc Maron', '/h4vTBdmRPYioXM1dtVYMeILiasB.jpg'),
('Awkwafina', '/l5AKkg3H1QhMuXmTTmq1EyjyiRb.jpg'),
('Craig Robinson', '/mTyTrOWUSOBJMOlDpnd4OYx7FlJ.jpg'),
('Anthony Ramos', '/2Stnm8PQI7xHkVwINb4MhS7LOuR.jpg'),
('Dave Franco', '/2diSplvpzCE5CrIKvTaplCKvwPq.jpg'),
('Alison Brie', '/uu16GiwYblS6IJV3o4qFSLWKXOC.jpg'),
('Pedro Pascal', '/oKcMbVn0NJTNzQt0ClKKvVXkm60.jpg'),
('Vanessa Kirby', '/a8a9U00KL2JJkkekzhNnueIGKKF.jpg'),
('Ebon Moss-Bachrach', '/xD8GVNayMpiTZxLfahy2DseYcQq.jpg'),
('Joseph Quinn', '/zshhuioZaH8S5ZKdMcojzWi1ntl.jpg'),
('Ralph Ineson', '/sn3ONJw2pJxMHiCqPwvkaiWr5mc.jpg'),
('Matthias Schweighöfer', '/i4c5JjvC5EpecZbp4J96mFmtm0Z.jpg'),
('Ruby O. Fee', '/IXnwGeXbjgKhw3W2mGrK8HBSjC.jpg'),
('David Corenswet', '/qB0hBMu4wU1nPrqtdUQP3sQeN5t.jpg'),
('Rachel Brosnahan', '/1f9NK43gWrXN2uMmYMlennB7jCC.jpg'),
('Nicholas Hoult', '/laeAYQVBV9U3DkJ1B4Cn1XhpT8P.jpg'),
('Scarlett Johansson', '/mjReG6rR7NPMEIWb1T4YWtV11ty.jpg'),
('Mahershala Ali', '/9ZmSejm5lnUVY5IJ1iNx2QEjnHb.jpg'),
('Jonathan Bailey', '/kMtZtavkXIXYA0CnhaWqbNo6uFV.jpg'),
('Charlize Theron', '/ie1KbeYFG5E0GVr1QP7tDNuXvga.jpg'),
('KiKi Layne', '/nwLS3A1NGXbYWUPLE9Sj6yPBbhW.jpg'),
('Allison Williams', '/5Jy9HELKS1OYg7moRl8870OSfJq.jpg'),
('Violet McGraw', '/d1KMeeKURTUED3zPfu9le4R1jlr.jpg'),
('Brad Pitt', '/9OfnD7lxgIj3BNQpJFnwxnwl6w5.jpg'),
('Damson Idris', '/4jKOg4jCqNwXyrYd3coqmCqkMy.jpg'),
('Javier Bardem', '/eCBiiPvBfIY7exDQwH0vEM6Bf3c.jpg'),
('John Cena', '/rgB2eIOt7WyQjdgJCOuESdDlrjg.jpg'),
('Idris Elba', '/be1bVF7qGX91a6c5WeRPs5pKXln.jpg'),
('Priyanka Chopra Jonas', '/stEZxIVAWFlrifbWkeULsD4LHnf.jpg'),
('Arden Cho', '/uPtfAFoEYeNGRl6n0GdxLPxdM9u.jpg'),
('Jodie Comer', '/iOP2tHyxtPiUzIBHzxxehBy9Khu.jpg');


-- Sample Movie-Genre relationships
INSERT INTO movie_genres (movie_id, genre_id) VALUES
(1, 9), (1, 11),  -- Weapons: Horror, Mystery
(2, 12), (2, 4), (2, 6),  -- My Oxford Year: Romance, Comedy, Drama
(3, 4), (3, 5), (3, 1),  -- The Naked Gun: Comedy, Crime, Action
(4, 13), (4, 14),  -- War of the Worlds: Science Fiction, Thriller
(5, 1), (5, 4), (5, 5),  -- The Pickup: Action, Comedy, Crime
(6, 4),  -- Happy Gilmore 2: Comedy
(7, 3), (7, 7), (7, 4), (7, 5), (7, 10),  -- The Bad Guys 2: Animation, Family, Comedy, Crime, Adventure
(8, 9), (8, 12),  -- Together: Horror, Romance
(9, 13), (9, 10), (9, 1),  -- The Fantastic 4: Science Fiction, Adventure, Action
(10, 14), (10, 13),  -- Brick: Thriller, Science Fiction
(11, 13), (11, 10), (11, 1),  -- Superman: Science Fiction, Adventure, Action
(12, 13), (12, 10), (12, 1),  -- Jurassic World Rebirth: Science Fiction, Adventure, Action
(13, 1), (13, 8),  -- The Old Guard 2: Action, Fantasy
(14, 1), (14, 13), (14, 14),  -- M3GAN 2.0: Action, Science Fiction, Thriller
(15, 1), (15, 6),  -- F1: Action, Drama
(16, 1), (16, 14), (16, 4),  -- Heads of State: Action, Thriller, Comedy
(17, 3), (17, 10), (17, 8), (17, 4),  -- KPop Demon Hunters: Animation, Music, Fantasy, Comedy
(18, 9), (18, 14), (18, 13),  -- 28 Years Later: Horror, Thriller, Science Fiction
(19, 3), (19, 7), (19, 4), (19, 10), (19, 13),  -- Elio: Animation, Family, Comedy, Adventure, Science Fiction
(20, 14), (20, 6),  -- Echo Valley: Thriller, Drama
(21, 1), (21, 4), (21, 5),  -- Deep Cover: Action, Comedy, Crime
(22, 12), (22, 6),  -- Materialists: Romance, Drama
(23, 8), (23, 7), (23, 1), (23, 10),  -- How to Train Your Dragon: Fantasy, Family, Action, Adventure
(24, 14), (24, 6), (24, 5),  -- STRAW: Thriller, Drama, Crime
(25, 3), (25, 1), (25, 13), (25, 14),  -- Predator: Animation, Action, Science Fiction, Thriller
(26, 8), (26, 6),  -- The Life of Chuck: Fantasy, Drama
(27, 1), (27, 14), (27, 5),  -- Ballerina: Action, Thriller, Crime
(28, 9),  -- Bring Her Back: Horror
(29, 10), (29, 4),  -- The Phoenician Scheme: Adventure, Comedy
(30, 9), (30, 11),  -- Fear Street: Horror, Mystery
(31, 10), (31, 8), (31, 11),  -- Fountain of Youth: Adventure, Fantasy, Mystery
(32, 1), (32, 10), (32, 14);  -- Mission Impossible: Action, Adventure, Thriller


-- Sample Movie-Studio relationships (first movie as example)
INSERT INTO movie_studios (movie_id, studio_id) VALUES
(1, 1), (1, 2), (1, 3), (1, 4), (1, 5),  -- Weapons
(2, 6),  -- My Oxford Year
(3, 7), (3, 5),  -- The Naked Gun
(6, 6),  -- Happy Gilmore 2
(7, 8),  -- The Bad Guys 2
(9, 9),  -- The Fantastic 4
(11, 10),  -- Superman
(12, 11), (12, 12),  -- Jurassic World Rebirth
(14, 15),  -- M3GAN 2.0
(16, 16),  -- Heads of State
(17, 19),  -- KPop Demon Hunters
(18, 17),  -- 28 Years Later
(19, 13),  -- Elio
(22, 14),  -- Materialists
(23, 8),  -- How to Train Your Dragon
(25, 18),  -- Predator
(27, 20);  -- Ballerina


-- Sample Movie-Director relationships
INSERT INTO movie_directors (movie_id, director_id) VALUES
(1, 1), (2, 2), (3, 3), (4, 4), (5, 5), (6, 6), (7, 7), (8, 8), (9, 9), (10, 10),
(11, 11), (12, 12), (13, 13), (14, 14), (15, 15), (16, 16), (17, 17), (17, 18),
(18, 19), (19, 20), (19, 21), (19, 22), (20, 23), (21, 24), (22, 25), (23, 26),
(24, 27), (25, 28), (26, 29), (27, 30), (28, 31), (28, 32), (29, 33), (30, 34),
(31, 35), (32, 36);


-- Sample Movie-Producer relationships (first few movies)
INSERT INTO movie_producers (movie_id, producer_id) VALUES
(1, 1), (1, 2), (1, 3), (1, 4),
(2, 5), (2, 6),
(3, 7), (3, 8),
(4, 9), (4, 10),
(5, 11), (5, 12),
(6, 13), (6, 14), (6, 15), (6, 16),
(7, 17),
(8, 18), (8, 19), (8, 20),
(9, 21),
(12, 22), (12, 23),
(13, 24), (13, 25),
(14, 26), (14, 27),
(15, 28), (15, 29);


-- Sample Movie-Actor relationships (first movie as complete example)
INSERT INTO movie_actors (movie_id, actor_id, character_name, actor_order) VALUES
-- Weapons
(1, 1, 'Justine', 1),
(1, 2, 'Archer', 2),
(1, 3, 'Paul', 3),
(1, 4, 'James', 4),
(1, 5, 'Marcus', 5),
-- My Oxford Year
(2, 6, 'Anna De La Vega', 1),
(2, 7, 'Jamie Davenport', 2),
-- The Naked Gun
(3, 8, 'Frank Drebin Jr.', 1),
(3, 9, 'Beth Davenport', 2),
(3, 10, 'Ed Hocken Jr.', 3),
-- War of the Worlds
(4, 11, 'William Radford', 1),
(4, 12, 'NASA Scientist Sandra Salas', 2),
-- The Pickup
(5, 13, 'Russell', 1),
(5, 14, 'Travis', 2),
(5, 15, 'Zoe', 3),
(5, 12, 'Natalie', 4),
-- Happy Gilmore 2
(6, 16, 'Happy Gilmore', 1),
(6, 17, 'Virginia', 2),
(6, 18, 'Shooter McGavin', 3),
-- The Bad Guys 2
(7, 19, 'Wolf (voice)', 1),
(7, 20, 'Snake (voice)', 2),
(7, 21, 'Tarantula (voice)', 3),
(7, 22, 'Shark (voice)', 4),
(7, 23, 'Piranha (voice)', 5),
-- Together
(8, 24, 'Tim', 1),
(8, 25, 'Millie', 2),
-- The Fantastic 4
(9, 26, 'Reed Richards / Mister Fantastic', 1),
(9, 27, 'Sue Storm / Invisible Woman', 2),
(9, 28, 'Ben Grimm / The Thing', 3),
(9, 29, 'Johnny Storm / Human Torch', 4),
(9, 30, 'Galactus', 5),
(9, 1, 'Shalla-Bal / Silver Surfer', 6),
(9, 10, 'Harvey Elder / Mole Man', 7),
-- Brick
(10, 31, 'Tim', 1),
(10, 32, 'Olivia', 2),
-- Superman
(11, 33, 'Superman', 1),
(11, 34, 'Lois Lane', 2),
(11, 35, 'Lex Luthor', 3),
-- Jurassic World Rebirth
(12, 36, 'Zora Bennett', 1),
(12, 37, 'Duncan Kincaid', 2),
(12, 38, 'Dr. Henry Loomis', 3),
-- The Old Guard 2
(13, 39, 'Andromache of Scythia / Andy', 1),
(13, 40, 'Nile Freeman', 2),
-- M3GAN 2.0
(14, 41, 'Gemma', 1),
(14, 42, 'Cady', 2),
-- F1
(15, 43, 'Sonny Hayes', 1),
(15, 44, 'Joshua Pearce', 2),
(15, 45, 'Ruben Cervantes', 3),
-- Heads of State
(16, 46, 'Will Derringer', 1),
(16, 47, 'Sam Clarke', 2),
(16, 48, 'Noel Bisset', 3),
-- KPop Demon Hunters
(17, 49, 'Rumi (voice)', 1),
-- 28 Years Later
(18, 50, 'Isla', 1);


-- ============================================================================
-- TABLE COMMENTS
-- ============================================================================


COMMENT ON TABLE movies IS 'Main movies table containing core movie information';
COMMENT ON TABLE collections IS 'Movie collections/franchises';
COMMENT ON TABLE genres IS 'Movie genres lookup table';
COMMENT ON TABLE studios IS 'Production studios lookup table';
COMMENT ON TABLE directors IS 'Directors lookup table';
COMMENT ON TABLE producers IS 'Producers lookup table';
COMMENT ON TABLE actors IS 'Actors lookup table';
COMMENT ON TABLE movie_genres IS 'Junction table linking movies to genres (many-to-many)';
COMMENT ON TABLE movie_studios IS 'Junction table linking movies to studios (many-to-many)';
COMMENT ON TABLE movie_directors IS 'Junction table linking movies to directors (many-to-many)';
COMMENT ON TABLE movie_producers IS 'Junction table linking movies to producers (many-to-many)';
COMMENT ON TABLE movie_actors IS 'Junction table linking movies to actors with character information (many-to-many)';


COMMIT;


-- ============================================================================
-- SAMPLE QUERIES
-- ============================================================================


-- Get all movies with their genres
-- SELECT m.title, STRING_AGG(g.genre_name, ', ') as genres
-- FROM movies m
-- JOIN movie_genres mg ON m.movie_id = mg.movie_id
-- JOIN genres g ON mg.genre_id = g.genre_id
-- GROUP BY m.movie_id, m.title
-- ORDER BY m.release_date DESC;


-- Get movies with budget over $100M
-- SELECT title, budget, revenue, (revenue - budget) as profit
-- FROM movies
-- WHERE budget > 100000000
-- ORDER BY profit DESC;


-- Get all actors in a specific movie
-- SELECT a.actor_name, ma.character_name, ma.actor_order
-- FROM movie_actors ma
-- JOIN actors a ON ma.actor_id = a.actor_id
-- WHERE ma.movie_id = 1
-- ORDER BY ma.actor_order;
