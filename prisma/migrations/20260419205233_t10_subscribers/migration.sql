-- CreateTable
CREATE TABLE "subscribers" (
    "id" SERIAL NOT NULL,
    "chat_id" TEXT NOT NULL,
    "username" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "joined_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "subscribers_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "subscribers_chat_id_key" ON "subscribers"("chat_id");
