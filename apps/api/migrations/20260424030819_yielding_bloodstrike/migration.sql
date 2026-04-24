CREATE TYPE "type" AS ENUM('person', 'group');--> statement-breakpoint
CREATE TYPE "prefecture" AS ENUM('Hokkaido', 'Aomori', 'Iwate', 'Miyagi', 'Akita', 'Yamagata', 'Fukushima', 'Ibaraki', 'Tochigi', 'Gunma', 'Saitama', 'Chiba', 'Tokyo', 'Kanagawa', 'Niigata', 'Toyama', 'Ishikawa', 'Fukui', 'Yamanashi', 'Nagano', 'Gifu', 'Shizuoka', 'Aichi', 'Mie', 'Shiga', 'Kyoto', 'Osaka', 'Hyogo', 'Nara', 'Wakayama', 'Tottori', 'Shimane', 'Okayama', 'Hiroshima', 'Yamaguchi', 'Tokushima', 'Kagawa', 'Ehime', 'Kochi', 'Fukuoka', 'Saga', 'Nagasaki', 'Kumamoto', 'Oita', 'Miyazaki', 'Kagoshima', 'Okinawa');--> statement-breakpoint
ALTER TABLE "artists" DROP CONSTRAINT "artists_type_check";--> statement-breakpoint
ALTER TABLE "artists" DROP CONSTRAINT "artists_birthplace_check";--> statement-breakpoint
ALTER TABLE "users" DROP CONSTRAINT "users_birthplace_check";--> statement-breakpoint
ALTER TABLE "artists" ALTER COLUMN "type" SET DATA TYPE "type" USING "type"::"type";--> statement-breakpoint
ALTER TABLE "artists" ALTER COLUMN "birthplace" SET DATA TYPE "prefecture" USING "birthplace"::"prefecture";--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "birthplace" SET DATA TYPE "prefecture" USING "birthplace"::"prefecture";