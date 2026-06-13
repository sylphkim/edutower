-- CreateIndex
CREATE UNIQUE INDEX "Conversation_userId_externalSessionId_key" ON "Conversation"("userId", "externalSessionId");
