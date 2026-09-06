-- CreateTable
CREATE TABLE "mensa_meal" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "priceStudents" DOUBLE PRECISION NOT NULL,
    "priceStaff" DOUBLE PRECISION,
    "priceOther" DOUBLE PRECISION,
    "date" DATE NOT NULL,
    "location" TEXT NOT NULL,
    "isVegan" BOOLEAN NOT NULL DEFAULT false,
    "isVegetarian" BOOLEAN NOT NULL DEFAULT false,
    "allergens" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "mensa_meal_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "mensa_meal_date_idx" ON "mensa_meal"("date");

-- CreateIndex
CREATE UNIQUE INDEX "mensa_meal_name_date_location_key" ON "mensa_meal"("name", "date", "location");
