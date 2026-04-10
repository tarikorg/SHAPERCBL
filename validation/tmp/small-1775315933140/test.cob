       IDENTIFICATION DIVISION.
       PROGRAM-ID. TEST-EMPLOYEE.
       ENVIRONMENT DIVISION.
       INPUT-OUTPUT SECTION.
       FILE-CONTROL.
           SELECT DATA-FILE ASSIGN TO "D:/cobol_shaper/examples/outputs/small.dat"
               ORGANIZATION IS LINE SEQUENTIAL.
       DATA DIVISION.
       FILE SECTION.
       FD  DATA-FILE.
       COPY "EMPLOYEE.cpy".
       WORKING-STORAGE SECTION.
       01  EOF-FLAG PIC X VALUE 'N'.
       PROCEDURE DIVISION.
           OPEN INPUT DATA-FILE.
           PERFORM UNTIL EOF-FLAG = 'Y'
               READ DATA-FILE
                   AT END MOVE 'Y' TO EOF-FLAG
                   NOT AT END DISPLAY EMP-ID " | " NAME
               END-READ
           END-PERFORM.
           CLOSE DATA-FILE.
           STOP RUN.
